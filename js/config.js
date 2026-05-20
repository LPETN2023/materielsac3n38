// ============================================================
// CONFIG.JS - Configuration Supabase
// ============================================================

// ⚠️ REMPLACEZ CES VALEURS PAR CELLES DE VOTRE PROJET SUPABASE
// Elles se trouvent dans : Supabase Dashboard > Settings > API
const SUPABASE_URL = 'https://ryfjulxsknibszxlznau.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_he7j_ayJTRNN-T4EAP_2Xw_EuUMc7_x';

// ============================================================
// Initialisation du client Supabase
// ============================================================
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// AUTH - Gestion de l'authentification
// ============================================================
const Auth = {
  currentUser: null,
  currentProfile: null,

  async init() {
    const { data: { session } } = await db.auth.getSession();
    if (session?.user) {
      await this.loadProfile(session.user);
    }

    db.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await this.loadProfile(session.user);
        App.navigate('dashboard');
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.currentProfile = null;
        App.navigate('login');
      }
    });

    return session;
  },

  async loadProfile(user) {
    this.currentUser = user;
    const { data } = await db.from('profiles').select('*').eq('id', user.id).single();
    this.currentProfile = data;

    if (data) {
      // Vérifie que le compte est actif
      if (!data.is_active) {
        await this.logout();
        UI.toast('Votre compte est désactivé. Contactez l\'administrateur.', 'error');
        return;
      }
      // Met à jour l'UI
      UI.updateUserDisplay(data);
    }
  },

  async login(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await Logs.write('LOGIN', null, null, { email });
    return data;
  },

  async logout() {
    await Logs.write('LOGOUT', null, null, {});
    await db.auth.signOut();
  },

  isAdmin() {
    return this.currentProfile?.role === 'admin';
  },

  isAuthenticated() {
    return !!this.currentUser;
  }
};

// ============================================================
// LOGS - Système d'audit
// ============================================================
const Logs = {
  async write(action, entityType, entityId, details = {}) {
    try {
      await db.from('audit_logs').insert({
        user_id: Auth.currentUser?.id || null,
        username: Auth.currentProfile?.full_name || Auth.currentUser?.email || 'Inconnu',
        action,
        entity_type: entityType,
        entity_id: entityId?.toString() || null,
        details
      });
    } catch (e) {
      console.error('Log error:', e);
    }
  }
};

// ============================================================
// ITEMS - Gestion des objets
// ============================================================
const Items = {
  async getByQR(qrCode) {
    const { data, error } = await db
      .from('items')
      .select('*')
      .eq('qr_code', qrCode)
      .single();
    return { data, error };
  },

  async getAll(filters = {}) {
    let query = db.from('items').select('*').order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) {
      query = query.or(
        `qr_code.ilike.%${filters.search}%,type.ilike.%${filters.search}%,brand.ilike.%${filters.search}%,model.ilike.%${filters.search}%,storage_location.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;
    return { data, error };
  },

  async create(itemData) {
    const { data, error } = await db.from('items').insert({
      ...itemData,
      created_by: Auth.currentUser.id
    }).select().single();

    if (!error) {
      await Logs.write('ITEM_CREATE', 'item', data.id, { qr_code: data.qr_code, type: data.type });
    }
    return { data, error };
  },

  async update(id, updates) {
    const { data, error } = await db.from('items').update(updates).eq('id', id).select().single();
    if (!error) {
      await Logs.write('ITEM_UPDATE', 'item', id, updates);
    }
    return { data, error };
  },

  async delete(id) {
    const { error } = await db.from('items').delete().eq('id', id);
    if (!error) {
      await Logs.write('ITEM_DELETE', 'item', id, {});
    }
    return { error };
  }
};

// ============================================================
// LOANS - Gestion des prêts
// ============================================================
const Loans = {
  async getActiveForItem(itemId) {
    const { data, error } = await db
      .from('loans')
      .select('*')
      .eq('item_id', itemId)
      .is('returned_at', null)
      .single();
    return { data, error };
  },

  async create(loanData) {
    const { data, error } = await db.from('loans').insert({
      ...loanData,
      created_by: Auth.currentUser.id
    }).select().single();

    if (!error) {
      // Met à jour le statut de l'objet
      await db.from('items').update({ status: 'loaned' }).eq('id', loanData.item_id);
      await Logs.write('LOAN_CREATE', 'loan', data.id, {
        item_id: loanData.item_id,
        loaned_to: loanData.loaned_to
      });
      // Mémorise le nom de la personne
      await Autocomplete.savePerson(loanData.loaned_to);
      if (loanData.judicial_operation) {
        await Autocomplete.saveOperation(loanData.judicial_operation);
      }
    }
    return { data, error };
  },

  async return(loanId, itemId, { return_notes }) {
    const { data, error } = await db.from('loans').update({
      returned_at: new Date().toISOString(),
      return_notes,
      returned_by: Auth.currentUser.id
    }).eq('id', loanId).select().single();

    if (!error) {
      await db.from('items').update({ status: 'available' }).eq('id', itemId);
      await Logs.write('LOAN_RETURN', 'loan', loanId, { item_id: itemId });
    }
    return { data, error };
  },

  async getHistory(itemId) {
    const { data, error } = await db
      .from('loans')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });
    return { data, error };
  }
};

// ============================================================
// AUTOCOMPLETE - Personnes et opérations
// ============================================================
const Autocomplete = {
  async getPersons(query = '') {
    let q = db.from('known_persons').select('name').order('usage_count', { ascending: false }).limit(20);
    if (query) q = q.ilike('name', `%${query}%`);
    const { data } = await q;
    return data?.map(d => d.name) || [];
  },

  async getOperations(query = '') {
    let q = db.from('judicial_operations').select('name').order('usage_count', { ascending: false }).limit(20);
    if (query) q = q.ilike('name', `%${query}%`);
    const { data } = await q;
    return data?.map(d => d.name) || [];
  },

  async savePerson(name) {
    if (!name) return;
    await db.from('known_persons').upsert(
      { name, usage_count: 1 },
      { onConflict: 'name', ignoreDuplicates: false }
    );
    // Incrémente le compteur si existe déjà
    await db.rpc('increment_person_count', { person_name: name }).catch(() => {});
  },

  async saveOperation(name) {
    if (!name) return;
    await db.from('judicial_operations').upsert(
      { name, usage_count: 1 },
      { onConflict: 'name', ignoreDuplicates: false }
    );
  }
};

// ============================================================
// USERS - Gestion des utilisateurs (admin)
// ============================================================
const Users = {
  async getAll() {
    const { data, error } = await db.from('profiles').select('*').order('created_at');
    return { data, error };
  },

  async create(email, password, fullName, role = 'user') {
    // Crée le compte auth via la fonction admin
    const { data: adminData, error: adminError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (adminError) throw adminError;

    // Crée le profil
    const { error: profileError } = await db.from('profiles').insert({
      id: adminData.user.id,
      username: email.split('@')[0],
      full_name: fullName,
      role
    });
    if (profileError) throw profileError;

    await Logs.write('USER_CREATE', 'user', adminData.user.id, { email, role });
    return adminData.user;
  },

  async toggle(userId, isActive) {
    const { error } = await db.from('profiles').update({ is_active: isActive }).eq('id', userId);
    await Logs.write(isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE', 'user', userId, {});
    return { error };
  },

  async setRole(userId, role) {
    const { error } = await db.from('profiles').update({ role }).eq('id', userId);
    await Logs.write('USER_ROLE_CHANGE', 'user', userId, { role });
    return { error };
  }
};

// ============================================================
// UTILS - Utilitaires
// ============================================================
const Utils = {
  formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  },

  formatDateTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  todayISO() {
    return new Date().toISOString().split('T')[0];
  },

  generateQR(prefix = 'INV') {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${ts}-${rand}`;
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
