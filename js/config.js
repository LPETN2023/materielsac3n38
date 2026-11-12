// ============================================================
// CONFIG.JS
// ============================================================

const SUPABASE_URL = 'https://ryfjulxsknibszxlznau.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5Zmp1bHhza25pYnN6eGx6bmF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTQ3NDYsImV4cCI6MjA5NDgzMDc0Nn0.cgCF3t6X7FSo1GITUoWEkhZFC_IuNJ3oIHbfXEkBCho';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
});
// Client secondaire sans persistance : sert uniquement à vérifier le mot de passe
// actuel (Paramètres) sans toucher à la session en cours.
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
    let { data: { session } } = await db.auth.getSession();
    if (session?.user) {
      const ok = await this.loadProfile(session.user);
      if (ok) this._scheduleRefresh(session);
      else session = null;
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

  // Renvoie false (et déconnecte) si le profil est absent ou désactivé.
  async loadProfile(user) {
    this.currentUser = user;
    const { data } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
    this.currentProfile = data;
    if (!data || !data.is_active) {
      this.currentUser = null;
      this.currentProfile = null;
      clearTimeout(this._refreshTimer);
      await db.auth.signOut();
      UI.toast(data ? 'Votre compte est désactivé.' : 'Compte inconnu : contactez un administrateur.', 'error');
      return false;
    }
    UI.updateUserDisplay(data);
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

  isAdmin() { return this.currentProfile?.role === 'admin'; },
  isAuthenticated() { return !!this.currentUser; }
};

// ============================================================
// LOGS
// La base journalise elle-même objets, prêts, types et comptes.
// Le navigateur n'écrit que LOGIN, LOGOUT et PASSWORD_CHANGE
// (l'auteur et la date sont imposés par la base).
// ============================================================
const Logs = {
  async write(action, entityType, entityId, details = {}) {
    try {
      await db.from('audit_logs').insert({
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
    return await db.from('items').select('*').eq('qr_code', qrCode).maybeSingle();
  },

  async getAll(filters = {}) {
    let query = db.from('items').select('*').order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    const s = Utils.cleanSearch(filters.search);
    if (s) query = query.or(
      `qr_code.ilike.%${s}%,type.ilike.%${s}%,brand.ilike.%${s}%,model.ilike.%${s}%,storage_location.ilike.%${s}%`
    );
    return await query;
  },

  // created_by / created_by_name sont imposés par la base
  async create(itemData) {
    return await db.from('items').insert(itemData).select().single();
  },

  async update(id, updates) {
    return await db.from('items').update(updates).eq('id', id).select().single();
  },

  async delete(id) {
    return await db.from('items').delete().eq('id', id);
  }
};

// ============================================================
// LOANS : prêt et retour passent par des fonctions de la base
// (vérification + verrouillage : un objet ne peut pas être prêté deux fois)
// ============================================================
const Loans = {
  async getActiveForItem(itemId) {
    return await db.from('loans').select('*')
      .eq('item_id', itemId).is('returned_at', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
  },

  async create(loanData) {
    return await db.rpc('preter_objet', {
      p_item_id: loanData.item_id,
      p_loaned_to: loanData.loaned_to,
      p_loan_date: loanData.loan_date || null,
      p_expected_return: loanData.expected_return_date || null,
      p_operation: loanData.operation || null,
      p_notes: loanData.notes || null
    });
  },

  // itemId conservé pour compatibilité des appels ; la base retrouve l'objet
  async return(loanId, itemId, { return_notes }) {
    if (!loanId) return { data: null, error: { message: 'Prêt introuvable' } };
    return await db.rpc('rendre_objet', { p_loan_id: loanId, p_return_notes: return_notes || null });
  },

  async getActiveFull(limit = 50) {
    return await db.from('loans')
      .select(`id, loaned_to, loan_date, expected_return_date, operation, notes, created_at,
               items ( id, qr_code, type, brand, model, storage_location )`)
      .is('returned_at', null)
      .order('loan_date', { ascending: true })
      .limit(limit);
  }
};

// ============================================================
// AUTOCOMPLETE (alimentée automatiquement par preter_objet)
// ============================================================
const Autocomplete = {
  async _list(table, query) {
    let q = db.from(table).select('name').order('usage_count', { ascending: false }).limit(20);
    const s = Utils.cleanSearch(query);
    if (s) q = q.ilike('name', `%${s}%`);
    const { data } = await q;
    return data?.map(d => d.name) || [];
  },
  getPersons(query = '') { return this._list('known_persons', query); },
  getOperations(query = '') { return this._list('operations', query); }
};

// ============================================================
// ITEM TYPES
// ============================================================
const ItemTypes = {
  async getAll() {
    const { data } = await db.from('item_types').select('*').order('sort_order').order('name');
    return data || [];
  },

  _cleanCode(code) {
    return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
  },

  async add(name, code) {
    return await db.from('item_types')
      .insert({ name: name.trim(), code: this._cleanCode(code) }).select().single();
  },

  async update(id, name, code) {
    return await db.from('item_types')
      .update({ name: name.trim(), code: this._cleanCode(code) }).eq('id', id).select().single();
  },

  async delete(id) {
    return await db.from('item_types').delete().eq('id', id);
  },

  // Récupère le code diminutif depuis la BDD
  async getCode(typeName) {
    if (!typeName) return 'DIV';
    const { data } = await db.from('item_types')
      .select('code').eq('name', typeName.trim()).maybeSingle();
    if (data?.code) return data.code;
    // Repli : 4 premières lettres
    const clean = typeName.replace(/[^a-zA-Z]/g, '').toUpperCase();
    return clean.substring(0, 4) || 'DIV';
  }
};

// ============================================================
// USERS
// La création passe par l'Edge Function « creer-compte » (vérifie que
// l'appelant est admin, le domaine email, crée compte + profil).
// ============================================================
const Users = {
  async getAll() { return await db.from('profiles').select('*').order('created_at'); },

  async create(email, password, fullName, role = 'user') {
    if (!email.toLowerCase().endsWith('@gendarmerie.interieur.gouv.fr')) {
      throw new Error('Seuls les emails @gendarmerie.interieur.gouv.fr sont autorisés');
    }
    const { data, error } = await db.functions.invoke('creer-compte', {
      body: { email, password, full_name: fullName, role }
    });
    if (error) {
      let msg = error.message;
      try { const body = await error.context.json(); if (body?.error) msg = body.error; } catch (_) {}
      throw new Error(msg);
    }
    return data;
  },

  async toggle(userId, isActive) {
    return await db.from('profiles').update({ is_active: isActive }).eq('id', userId);
  },

  async setRole(userId, role) {
    return await db.from('profiles').update({ role }).eq('id', userId);
  }
};

// ============================================================
// UTILS
// ============================================================
const Utils = {
  formatDate(date) {
    if (!date) return '-';
    // Une date seule (AAAA-MM-JJ) est lue comme date locale, pas UTC
    const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T00:00:00') : new Date(date);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },
  formatDateTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  },
  // Date du jour en heure locale (et non UTC : évite « hier » entre minuit et 2 h)
  todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  // Génère un code QR avec le diminutif du type depuis la BDD
  async generateQR(typeName = '') {
    const prefix = 'AC3N38';
    const typeCode = typeName ? await ItemTypes.getCode(typeName) : 'DIV';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code, exists;
    do {
      const rnd = crypto.getRandomValues(new Uint32Array(6));
      const rand = Array.from(rnd, n => chars[n % chars.length]).join('');
      code = `${prefix}-${typeCode}-${rand}`;
      const { data } = await db.from('items').select('id').eq('qr_code', code).maybeSingle();
      exists = !!data;
    } while (exists);
    return code;
  },
  // Texte à insérer dans du HTML
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  // Argument de fonction dans un attribut onclick="..." : chaîne JS sûre, puis échappée pour HTML
  jsArg(str) {
    return Utils.escapeHtml(JSON.stringify(str === null || str === undefined ? '' : String(str)));
  },
  // Retire les caractères qui ont un sens dans les filtres de recherche Supabase
  cleanSearch(str) {
    return String(str || '').replace(/[,()"'\\%*]/g, ' ').trim().substring(0, 100);
  },
  isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr + 'T00:00:00') < new Date(new Date().toDateString());
  },
  daysOverdue(dateStr) {
    if (!dateStr) return 0;
    const diff = new Date(new Date().toDateString()) - new Date(dateStr + 'T00:00:00');
    return Math.floor(diff / 86400000);
  }
};
