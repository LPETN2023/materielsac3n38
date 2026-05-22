// ============================================================
// CONFIG.JS
// ============================================================

const SUPABASE_URL = 'https://ryfjulxsknibszxlznau.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5Zmp1bHhza25pYnN6eGx6bmF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTQ3NDYsImV4cCI6MjA5NDgzMDc0Nn0.cgCF3t6X7FSo1GITUoWEkhZFC_IuNJ3oIHbfXEkBCho';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
});
// Client secondaire sans persistance de session (création de comptes)
const dbSignup = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
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

    db.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        this.currentUser = session.user;
        this._scheduleRefresh(session);
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

    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        const { data: { session } } = await db.auth.getSession();
        if (!session && Auth.currentUser) {
          Auth.currentUser = null; Auth.currentProfile = null; App.navigate('login');
        } else if (session?.user && App.currentPage !== 'login') {
          const mc = document.getElementById('main-content');
          if (mc && mc.innerHTML.trim() === '') App.navigate(App.currentPage || 'dashboard');
        }
      }
    });

    return session;
  },

  _scheduleRefresh(session) {
    clearTimeout(this._refreshTimer);
    if (!session?.expires_at) return;
    const ms = (session.expires_at * 1000) - Date.now() - 120000;
    if (ms > 0) this._refreshTimer = setTimeout(() => db.auth.refreshSession(), ms);
  },

  async loadProfile(user) {
    this.currentUser = user;
    const { data } = await db.from('profiles').select('*').eq('id', user.id).single();
    this.currentProfile = data;
    if (data) {
      if (!data.is_active) { await this.logout(); UI.toast('Votre compte est désactivé.', 'error'); return false; }
      UI.updateUserDisplay(data);
    }
    return true;
  },

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

  // Changement de mot de passe : vérifie l'ancien en se re-authentifiant
  async changePassword(oldPassword, newPassword) {
    const email = this.currentUser.email;
    // Vérifie l'ancien mot de passe via un client temporaire
    const { error: checkError } = await dbSignup.auth.signInWithPassword({ email, password: oldPassword });
    if (checkError) throw new Error('Mot de passe actuel incorrect');
    // Met à jour avec le nouveau
    const { error: updateError } = await db.auth.updateUser({ password: newPassword });
    if (updateError) throw updateError;
    // Retire le flag must_change_password si présent
    await db.from('profiles').update({ must_change_password: false }).eq('id', this.currentUser.id);
    this.currentProfile.must_change_password = false;
    await Logs.write('PASSWORD_CHANGE', 'user', this.currentUser.id, {});
  },

  isAdmin() { return this.currentProfile?.role === 'admin'; },
  isAuthenticated() { return !!this.currentUser; },
  mustChangePassword() { return !!this.currentProfile?.must_change_password; }
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
        action, entity_type: entityType,
        entity_id: entityId?.toString() || null, details
      });
    } catch (e) { console.error('Log error:', e); }
  }
};

// ============================================================
// ITEMS
// ============================================================
const Items = {
  async getByQR(qrCode) {
    return await db.from('items').select('*').eq('qr_code', qrCode).single();
  },

  async getAll(filters = {}) {
    let query = db.from('items').select('*').order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) query = query.or(
      `qr_code.ilike.%${filters.search}%,type.ilike.%${filters.search}%,brand.ilike.%${filters.search}%,model.ilike.%${filters.search}%,storage_location.ilike.%${filters.search}%`
    );
    return await query;
  },

  async create(itemData) {
    const { data, error } = await db.from('items').insert({
      ...itemData,
      created_by: Auth.currentUser.id,
      created_by_name: Auth.currentProfile?.full_name || Auth.currentUser?.email || 'Inconnu'
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
      created_by: Auth.currentUser.id,
      created_by_name: Auth.currentProfile?.full_name || Auth.currentUser?.email || 'Inconnu'
    }).select().single();

    if (!error) {
      await db.from('items').update({ status: 'loaned' }).eq('id', loanData.item_id);
      await Logs.write('LOAN_CREATE', 'loan', data.id, { item_id: loanData.item_id, loaned_to: loanData.loaned_to });
      await Autocomplete.savePerson(loanData.loaned_to);
      if (loanData.judicial_operation) await Autocomplete.saveOperation(loanData.judicial_operation);
    }
    return { data, error };
  },

  async return(loanId, itemId, { return_notes }) {
    const { data, error } = await db.from('loans').update({
      returned_at: new Date().toISOString(),
      return_notes,
      returned_by: Auth.currentUser.id,
      returned_by_name: Auth.currentProfile?.full_name || Auth.currentUser?.email || 'Inconnu'
    }).eq('id', loanId).select().single();

    if (!error) {
      await db.from('items').update({ status: 'available' }).eq('id', itemId);
      await Logs.write('LOAN_RETURN', 'loan', loanId, { item_id: itemId });
    }
    return { data, error };
  },

  async getActiveFull(limit = 50) {
    return await db.from('loans')
      .select(`id, loaned_to, loan_date, expected_return_date, judicial_operation, notes, created_at,
               items ( id, qr_code, type, brand, model, storage_location )`)
      .is('returned_at', null)
      .order('loan_date', { ascending: true })
      .limit(limit);
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
    const { data: ex } = await db.from('known_persons').select('id,usage_count').eq('name', name).single();
    if (ex) await db.from('known_persons').update({ usage_count: ex.usage_count + 1 }).eq('name', name);
    else await db.from('known_persons').insert({ name, usage_count: 1 });
  },
  async saveOperation(name) {
    if (!name) return;
    const { data: ex } = await db.from('judicial_operations').select('id,usage_count').eq('name', name).single();
    if (ex) await db.from('judicial_operations').update({ usage_count: ex.usage_count + 1 }).eq('name', name);
    else await db.from('judicial_operations').insert({ name, usage_count: 1 });
  }
};

// ============================================================
// ITEM TYPES
// ============================================================
const ItemTypes = {
  async getAll() {
    const { data } = await db.from('item_types').select('*').order('sort_order').order('name');
    return data || [];
  },
  async add(name) {
    const { data, error } = await db.from('item_types').insert({ name: name.trim() }).select().single();
    if (!error) await Logs.write('ITEMTYPE_CREATE', 'item_type', data.id, { name });
    return { data, error };
  },
  async delete(id) {
    const { error } = await db.from('item_types').delete().eq('id', id);
    if (!error) await Logs.write('ITEMTYPE_DELETE', 'item_type', id, {});
    return { error };
  }
};

// ============================================================
// USERS
// ============================================================
const Users = {
  async getAll() { return await db.from('profiles').select('*').order('created_at'); },

  async create(email, password, fullName, role = 'user', mustChange = true) {
    if (!email.toLowerCase().endsWith('@gendarmerie.interieur.gouv.fr')) {
      throw new Error('Seuls les emails @gendarmerie.interieur.gouv.fr sont autorisés');
    }
    const { data, error: signUpError } = await dbSignup.auth.signUp({
      email, password, options: { data: { full_name: fullName } }
    });
    if (signUpError) throw signUpError;
    if (!data.user) throw new Error('Erreur lors de la création du compte');

    const { error: profileError } = await db.from('profiles').insert({
      id: data.user.id,
      username: email.split('@')[0].toLowerCase(),
      full_name: fullName,
      role,
      is_active: true,
      must_change_password: mustChange  // Force le changement à la première connexion
    });
    if (profileError) throw new Error('Compte créé mais profil non enregistré : ' + profileError.message);

    await Logs.write('USER_CREATE', 'user', data.user.id, { email, role });
    return data.user;
  },

  // Reset mot de passe par admin : met le flag + stocke le mot de passe temporaire en clair
  // L'admin doit AUSSI mettre à jour le mot de passe dans Supabase Dashboard > Auth > Users
  async resetPassword(userId, tempPassword) {
    const { error } = await db.from('profiles').update({
      must_change_password: true,
      temp_password_hint: tempPassword  // Stocké pour affichage à l'admin uniquement
    }).eq('id', userId);
    await Logs.write('PASSWORD_RESET', 'user', userId, {});
    return { error };
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
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },
  formatDateTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  },
  todayISO() { return new Date().toISOString().split('T')[0]; },
  generateQR(prefix = 'INV') {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${ts}-${rand}`;
  },
  generateTempPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  },
  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
  isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date(new Date().toDateString());
  },
  daysOverdue(dateStr) {
    if (!dateStr) return 0;
    const diff = new Date(new Date().toDateString()) - new Date(dateStr);
    return Math.floor(diff / 86400000);
  }
};
