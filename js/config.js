// ============================================================
// CONFIG.JS - Configuration Supabase
// ============================================================

// ⚠️ REMPLACEZ CES VALEURS PAR CELLES DE VOTRE PROJET SUPABASE
const SUPABASE_URL = 'https://ryfjulxsknibszxlznau.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5Zmp1bHhza25pYnN6eGx6bmF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTQ3NDYsImV4cCI6MjA5NDgzMDc0Nn0.cgCF3t6X7FSo1GITUoWEkhZFC_IuNJ3oIHbfXEkBCho';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// ============================================================
// AUTH
// ============================================================
const Auth = {
  currentUser: null,
  currentProfile: null,
  _refreshTimer: null,

  async init() {
    const { data: { session } } = await db.auth.getSession();
    if (session?.user) {
      await this.loadProfile(session.user);
      this._scheduleRefresh(session);
    }

    // onAuthStateChange : uniquement pour déconnexion et refresh de token
    db.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        this.currentUser = session.user;
        this._scheduleRefresh(session);
        // Re-render si page blanche (currentPage connu mais contenu vide)
        const mc = document.getElementById('main-content');
        if (App.currentPage && App.currentPage !== 'login' && mc && mc.children.length === 0) {
          App.navigate(App.currentPage);
        }
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.currentProfile = null;
        clearTimeout(this._refreshTimer);
        App.navigate('login');
      }
    });

    // Récupération de session quand l'onglet redevient visible
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        const { data: { session } } = await db.auth.getSession();
        if (!session && Auth.currentUser) {
          // Session perdue
          Auth.currentUser = null;
          Auth.currentProfile = null;
          App.navigate('login');
        } else if (session?.user && App.currentPage !== 'login') {
          // Re-render si page blanche
          const mc = document.getElementById('main-content');
          if (mc && mc.innerHTML.trim() === '') {
            App.navigate(App.currentPage || 'dashboard');
          }
        }
      }
    });

    return session;
  },

  // Planifie un refresh proactif du token 2 min avant expiration
  _scheduleRefresh(session) {
    clearTimeout(this._refreshTimer);
    if (!session?.expires_at) return;
    const expiresInMs = (session.expires_at * 1000) - Date.now() - 120000; // 2 min avant
    if (expiresInMs > 0) {
      this._refreshTimer = setTimeout(async () => {
        await db.auth.refreshSession();
      }, expiresInMs);
    }
  },

  async loadProfile(user) {
    this.currentUser = user;
    const { data } = await db.from('profiles').select('*').eq('id', user.id).single();
    this.currentProfile = data;
    if (data) {
      if (!data.is_active) {
        await this.logout();
        UI.toast('Votre compte est désactivé.', 'error');
        return false;
      }
      UI.updateUserDisplay(data);
    }
    return true;
  },

  // FIX: login explicite sans dépendre de onAuthStateChange pour la navigation
  async login(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const ok = await this.loadProfile(data.user);
    if (!ok) throw new Error('Compte désactivé');

    this._scheduleRefresh(data.session);
    await Logs.write('LOGIN', null, null, { email });
    return data;
  },

  async logout() {
    try { await Logs.write('LOGOUT', null, null, {}); } catch (_) {}
    clearTimeout(this._refreshTimer);
    await db.auth.signOut();
  },

  isAdmin() { return this.currentProfile?.role === 'admin'; },
  isAuthenticated() { return !!this.currentUser; }
};

// ============================================================
// LOGS
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
    } catch (e) { console.error('Log error:', e); }
  }
};

// ============================================================
// ITEMS
// ============================================================
const Items = {
  async getByQR(qrCode) {
    const { data, error } = await db.from('items').select('*').eq('qr_code', qrCode).single();
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
    return await query;
  },

  async create(itemData) {
    const { data, error } = await db.from('items').insert({
      ...itemData,
      created_by: Auth.currentUser.id
    }).select().single();
    if (!error) await Logs.write('ITEM_CREATE', 'item', data.id, { qr_code: data.qr_code, type: data.type });
    return { data, error };
  },

  async update(id, updates) {
    const { data, error } = await db.from('items').update(updates).eq('id', id).select().single();
    if (!error) await Logs.write('ITEM_UPDATE', 'item', id, updates);
    return { data, error };
  },

  async delete(id) {
    const { error } = await db.from('items').delete().eq('id', id);
    if (!error) await Logs.write('ITEM_DELETE', 'item', id, {});
    return { error };
  }
};

// ============================================================
// LOANS
// ============================================================
const Loans = {
  async getActiveForItem(itemId) {
    const { data, error } = await db.from('loans').select('*')
      .eq('item_id', itemId).is('returned_at', null)
      .order('created_at', { ascending: false }).limit(1).single();
    return { data, error };
  },

  async create(loanData) {
    const { data, error } = await db.from('loans').insert({
      ...loanData,
      created_by: Auth.currentUser.id
    }).select().single();

    if (!error) {
      await db.from('items').update({ status: 'loaned' }).eq('id', loanData.item_id);
      await Logs.write('LOAN_CREATE', 'loan', data.id, {
        item_id: loanData.item_id, loaned_to: loanData.loaned_to
      });
      await Autocomplete.savePerson(loanData.loaned_to);
      if (loanData.judicial_operation) await Autocomplete.saveOperation(loanData.judicial_operation);
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

  // FIX: JOIN direct via Supabase pour le dashboard
  async getActiveFull(limit = 10) {
    const { data, error } = await db
      .from('loans')
      .select(`
        id, loaned_to, loan_date, judicial_operation, notes, created_at,
        items ( id, qr_code, type, brand, model, storage_location )
      `)
      .is('returned_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
  }
};

// ============================================================
// AUTOCOMPLETE
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
    const { data: existing } = await db.from('known_persons').select('id, usage_count').eq('name', name).single();
    if (existing) {
      await db.from('known_persons').update({ usage_count: existing.usage_count + 1 }).eq('name', name);
    } else {
      await db.from('known_persons').insert({ name, usage_count: 1 });
    }
  },

  async saveOperation(name) {
    if (!name) return;
    const { data: existing } = await db.from('judicial_operations').select('id, usage_count').eq('name', name).single();
    if (existing) {
      await db.from('judicial_operations').update({ usage_count: existing.usage_count + 1 }).eq('name', name);
    } else {
      await db.from('judicial_operations').insert({ name, usage_count: 1 });
    }
  }
};

// ============================================================
// USERS - FIX: utilise signUp au lieu de auth.admin.createUser
// ============================================================
const Users = {
  async getAll() {
    return await db.from('profiles').select('*').order('created_at');
  },

  // FIX: signUp fonctionne côté client sans service_role key
  // Désactivez la confirmation email dans Supabase > Auth > Settings
  async create(email, password, fullName, role = 'user') {
    // Crée le compte auth
    const { data, error: signUpError } = await db.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (signUpError) throw signUpError;
    if (!data.user) throw new Error('Erreur création compte');

    // Insère le profil manuellement
    const { error: profileError } = await db.from('profiles').insert({
      id: data.user.id,
      username: email.split('@')[0].toLowerCase(),
      full_name: fullName,
      role,
      is_active: true
    });
    if (profileError) throw profileError;

    await Logs.write('USER_CREATE', 'user', data.user.id, { email, role });
    return data.user;
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
// UTILS
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
    return new Date(date).toLocaleString('fr-FR', {
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
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};
