// ============================================================
// PAGES.JS - Rendus de toutes les pages
// ============================================================
const Pages = {

  // ============================================================
  // HELPERS
  // ============================================================
  getMainContent() {
    return document.getElementById('main-content');
  },

  renderHeader(title, actions = '') {
    return `
      <div class="page-header">
        <button class="sidebar-toggle" id="sidebar-toggle">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <h1 class="page-header-title">${title}</h1>
        ${actions}
      </div>
    `;
  },

  // ============================================================
  // LOGIN
  // ============================================================
  renderLogin() {
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('qr-fab').style.display = 'none';

    document.getElementById('app').innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-header">
            <div class="login-logo">🔒</div>
            <h1 class="login-title">Inventaire Judiciaire</h1>
            <p class="login-subtitle">Connectez-vous pour accéder au système</p>
          </div>

          <div id="login-error" class="alert alert-danger hidden">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span id="login-error-msg">Identifiants incorrects</span>
          </div>

          <div class="form-group">
            <label class="form-label">Adresse e-mail</label>
            <input type="email" id="login-email" class="form-control" placeholder="votre@email.fr" autocomplete="email"/>
          </div>
          <div class="form-group">
            <label class="form-label">Mot de passe</label>
            <input type="password" id="login-password" class="form-control" placeholder="••••••••" autocomplete="current-password"/>
          </div>
          <button class="btn btn-primary btn-full btn-lg" id="login-btn">
            Se connecter
          </button>

          <p class="text-center text-xs text-muted mt-4" style="margin-top:20px">
            Système sécurisé — accès réservé aux personnels autorisés
          </p>
        </div>
      </div>
    `;

    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-password');
    const btn = document.getElementById('login-btn');
    const errorEl = document.getElementById('login-error');
    const errorMsg = document.getElementById('login-error-msg');

    const doLogin = async () => {
      const email = emailEl.value.trim();
      const pass = passEl.value;
      if (!email || !pass) {
        errorMsg.textContent = 'Veuillez remplir tous les champs';
        errorEl.classList.remove('hidden');
        return;
      }
      UI.setLoading(btn, true);
      try {
        await Auth.login(email, pass);
        errorEl.classList.add('hidden');
        document.getElementById('sidebar').style.display = '';
        document.getElementById('qr-fab').style.display = '';
      } catch (e) {
        errorMsg.textContent = 'Identifiants incorrects ou compte désactivé';
        errorEl.classList.remove('hidden');
        UI.setLoading(btn, false);
      }
    };

    btn.addEventListener('click', doLogin);
    passEl.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    emailEl.addEventListener('keydown', e => { if (e.key === 'Enter') passEl.focus(); });
  },

  // ============================================================
  // DASHBOARD
  // ============================================================
  async renderDashboard() {
    document.getElementById('sidebar').style.display = '';
    document.getElementById('qr-fab').style.display = '';
    const content = Pages.getMainContent();

    content.innerHTML = Pages.renderHeader('Tableau de bord') + `
      <div class="page-body">
        <div class="stats-grid" id="stats-grid">
          <div class="stat-card"><div class="spinner"></div></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Dernières activités</span></div>
          <div class="card-body" id="recent-loans"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    // Chargement stats
    const [allItems, loans] = await Promise.all([
      Items.getAll(),
      db.from('loans').select('*').is('returned_at', null).order('created_at', { ascending: false }).limit(10)
    ]);

    const items = allItems.data || [];
    const available = items.filter(i => i.status === 'available').length;
    const loaned = items.filter(i => i.status === 'loaned').length;

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="background:#E8EDF5">📦</div>
        <div class="stat-info">
          <div class="stat-value">${items.length}</div>
          <div class="stat-label">Objets total</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--c-success-bg)">✅</div>
        <div class="stat-info">
          <div class="stat-value" style="color:var(--c-success)">${available}</div>
          <div class="stat-label">Disponibles</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--c-warning-bg)">🔄</div>
        <div class="stat-info">
          <div class="stat-value" style="color:var(--c-warning)">${loaned}</div>
          <div class="stat-label">En prêt</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--c-info-bg)">🔍</div>
        <div class="stat-info">
          <div class="stat-value" style="color:var(--c-info)">${loans.data?.length || 0}</div>
          <div class="stat-label">Prêts actifs</div>
        </div>
      </div>
    `;

    const recentEl = document.getElementById('recent-loans');
    if (!loans.data?.length) {
      recentEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p class="empty-state-text">Aucun prêt actif</p></div>';
      return;
    }

    // Charge les items pour les prêts
    const itemIds = [...new Set(loans.data.map(l => l.item_id))];
    const { data: loanItems } = await db.from('items').select('id,qr_code,type,brand,model').in('id', itemIds);
    const itemMap = Object.fromEntries((loanItems || []).map(i => [i.id, i]));

    recentEl.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Objet</th><th>Prêté à</th><th>Opération</th><th>Date de prêt</th>
          </tr></thead>
          <tbody>
            ${loans.data.map(loan => {
              const item = itemMap[loan.item_id];
              return `<tr>
                <td>
                  <div style="font-weight:600">${Utils.escapeHtml(item?.brand || item?.type || '—')}</div>
                  <div class="text-xs text-muted font-mono">${Utils.escapeHtml(item?.qr_code || '')}</div>
                </td>
                <td>${Utils.escapeHtml(loan.loaned_to)}</td>
                <td>${Utils.escapeHtml(loan.judicial_operation || '—')}</td>
                <td>${Utils.formatDate(loan.loan_date)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Re-bind toggle
    App.bindGlobalEvents && document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebar-overlay').classList.toggle('open');
    });
  },

  // ============================================================
  // INVENTAIRE
  // ============================================================
  async renderInventory(params = {}) {
    const content = Pages.getMainContent();
    content.innerHTML = Pages.renderHeader('Inventaire', `
      <button class="btn btn-primary btn-sm" id="add-item-btn">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Ajouter un objet
      </button>
    `) + `
      <div class="page-body">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" class="search-input" id="inv-search" placeholder="Rechercher par type, marque, modèle, code..."/>
          </div>
          <select class="form-control" id="inv-status" style="width:auto;min-width:160px">
            <option value="">Tous les statuts</option>
            <option value="available">Disponible</option>
            <option value="loaned">En prêt</option>
          </select>
        </div>
        <div id="inventory-table">
          <div class="empty-state"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    const loadInventory = async () => {
      const search = document.getElementById('inv-search')?.value.trim() || '';
      const status = document.getElementById('inv-status')?.value || '';
      const { data, error } = await Items.getAll({ search, status });

      const el = document.getElementById('inventory-table');
      if (!el) return;

      if (error) {
        el.innerHTML = '<div class="alert alert-danger">Erreur de chargement</div>';
        return;
      }

      if (!data?.length) {
        el.innerHTML = `<div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <p class="empty-state-text">Aucun objet trouvé</p>
          <p class="empty-state-sub">Scannez un QR code pour enregistrer un nouvel objet</p>
        </div>`;
        return;
      }

      el.innerHTML = `
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>Code QR</th><th>Type</th><th>Marque / Modèle</th>
              <th>Stockage</th><th>Statut</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${data.map(item => `
                <tr>
                  <td><span class="font-mono text-xs">${Utils.escapeHtml(item.qr_code)}</span></td>
                  <td>${Utils.escapeHtml(item.type)}</td>
                  <td>
                    <div>${Utils.escapeHtml(item.brand || '—')}</div>
                    <div class="text-xs text-muted">${Utils.escapeHtml(item.model || '')}</div>
                  </td>
                  <td>${Utils.escapeHtml(item.storage_location)}</td>
                  <td>
                    <span class="badge badge-${item.status === 'available' ? 'available' : 'loaned'}">
                      ${item.status === 'available' ? 'Disponible' : 'En prêt'}
                    </span>
                  </td>
                  <td>
                    <div class="btn-group">
                      <button class="btn btn-ghost btn-sm" onclick="Pages.openEditItem('${item.id}')">✏️ Modifier</button>
                      ${Auth.isAdmin() ? `<button class="btn btn-ghost btn-sm" style="color:var(--c-danger)" onclick="Pages.deleteItem('${item.id}')">🗑</button>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    await loadInventory();

    document.getElementById('inv-search')?.addEventListener('input', () => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(loadInventory, 300);
    });

    document.getElementById('inv-status')?.addEventListener('change', loadInventory);

    document.getElementById('add-item-btn')?.addEventListener('click', () => {
      Pages.renderRegisterItem('');
    });
  },

  // ============================================================
  // FORMULAIRE: ENREGISTRER UN OBJET
  // ============================================================
  renderRegisterItem(qrCode) {
    document.getElementById('register-qr').value = qrCode || Utils.generateQR();
    document.getElementById('register-type').value = '';
    document.getElementById('register-brand').value = '';
    document.getElementById('register-model').value = '';
    document.getElementById('register-desc').value = '';
    document.getElementById('register-location').value = '';

    UI.modal.open('register-modal');
  },

  // ============================================================
  // FORMULAIRE: PRÊT
  // ============================================================
  renderLoanForm(item) {
    document.getElementById('loan-item-id').value = item.id;
    document.getElementById('loan-item-info').innerHTML = `
      <div class="alert alert-info">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <div>
          <strong>${Utils.escapeHtml(item.type)}${item.brand ? ' — ' + Utils.escapeHtml(item.brand) : ''}${item.model ? ' ' + Utils.escapeHtml(item.model) : ''}</strong><br>
          <span class="text-xs">QR: ${Utils.escapeHtml(item.qr_code)} | Stockage: ${Utils.escapeHtml(item.storage_location)}</span>
        </div>
      </div>
    `;
    document.getElementById('loan-to').value = '';
    document.getElementById('loan-date').value = Utils.todayISO();
    document.getElementById('loan-operation').value = '';
    document.getElementById('loan-notes').value = '';

    UI.modal.open('loan-modal');

    // Autocomplétion
    const loanToEl = document.getElementById('loan-to');
    const opEl = document.getElementById('loan-operation');
    if (!loanToEl.dataset.ac) {
      initAutocomplete(loanToEl, q => Autocomplete.getPersons(q));
      initAutocomplete(opEl, q => Autocomplete.getOperations(q));
      loanToEl.dataset.ac = '1';
    }
  },

  // ============================================================
  // FORMULAIRE: RESTITUTION
  // ============================================================
  renderReturnForm(item, loan) {
    document.getElementById('return-item-id').value = item.id;
    document.getElementById('return-loan-id').value = loan?.id || '';
    document.getElementById('return-date').value = Utils.todayISO();
    document.getElementById('return-notes').value = '';
    document.getElementById('return-item-info').innerHTML = `
      <div class="alert alert-warning">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        <div>
          <strong>Objet en prêt</strong><br>
          ${Utils.escapeHtml(item.type)} ${item.brand ? '— ' + Utils.escapeHtml(item.brand) : ''} ${item.model ? Utils.escapeHtml(item.model) : ''}<br>
          <span class="text-xs">Prêté à: <strong>${Utils.escapeHtml(loan?.loaned_to || '?')}</strong> | Opération: ${Utils.escapeHtml(loan?.judicial_operation || '—')}</span><br>
          <span class="text-xs">📍 Lieu de stockage: <strong>${Utils.escapeHtml(item.storage_location)}</strong></span>
        </div>
      </div>
    `;
    UI.modal.open('return-modal');
  },

  // ============================================================
  // MODIFIER UN OBJET
  // ============================================================
  async openEditItem(itemId) {
    const { data: item } = await db.from('items').select('*').eq('id', itemId).single();
    if (!item) { UI.toast('Objet introuvable', 'error'); return; }

    document.getElementById('edit-item-id').value = item.id;
    document.getElementById('edit-qr').value = item.qr_code;
    document.getElementById('edit-type').value = item.type;
    document.getElementById('edit-brand').value = item.brand || '';
    document.getElementById('edit-model').value = item.model || '';
    document.getElementById('edit-desc').value = item.description || '';
    document.getElementById('edit-location').value = item.storage_location;
    document.getElementById('edit-status').value = item.status;

    UI.modal.open('edit-modal');
  },

  async deleteItem(itemId) {
    const confirmed = await UI.confirm('Supprimer définitivement cet objet ?');
    if (!confirmed) return;

    const { error } = await Items.delete(itemId);
    if (error) UI.toast('Erreur lors de la suppression', 'error');
    else {
      UI.toast('Objet supprimé', 'success');
      Pages.renderInventory();
    }
  },

  // ============================================================
  // QR CODES - Génération et impression
  // ============================================================
  async renderQRCodes() {
    const content = Pages.getMainContent();
    content.innerHTML = Pages.renderHeader('Génération QR Codes', `
      <button class="btn btn-primary btn-sm no-print" onclick="Pages.printQRPage()">
        🖨️ Imprimer
      </button>
    `) + `
      <div class="page-body">
        <div class="card no-print" style="margin-bottom:var(--space-5)">
          <div class="card-header"><span class="card-title">Options d'affichage</span></div>
          <div class="card-body">
            <div class="form-row">
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Position du code texte</label>
                <select class="form-control" id="qr-label-pos">
                  <option value="below">Sous le QR code</option>
                  <option value="above">Au-dessus du QR code</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Filtrer par statut</label>
                <select class="form-control" id="qr-filter-status">
                  <option value="">Tous</option>
                  <option value="available">Disponible</option>
                  <option value="loaned">En prêt</option>
                </select>
              </div>
            </div>
            <div style="margin-top:var(--space-4);display:flex;gap:var(--space-3)">
              <div class="form-group" style="margin-bottom:0;flex:1">
                <label class="form-label">QR codes sélectionnés</label>
                <select class="form-control" id="qr-selection" multiple style="height:100px">
                  <option value="all" selected>Tous les objets</option>
                </select>
              </div>
              <div style="align-self:flex-end">
                <button class="btn btn-secondary btn-sm" id="refresh-qr-btn">🔄 Actualiser</button>
              </div>
            </div>
          </div>
        </div>

        <div id="qr-preview" class="card">
          <div class="card-header"><span class="card-title">Aperçu — Page A4</span></div>
          <div class="card-body">
            <div id="qr-grid-container" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:16px">
              <div class="empty-state"><div class="spinner"></div></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const loadQRCodes = async () => {
      const status = document.getElementById('qr-filter-status')?.value || '';
      const labelPos = document.getElementById('qr-label-pos')?.value || 'below';
      const { data: items } = await Items.getAll({ status });
      const container = document.getElementById('qr-grid-container');
      if (!container) return;

      if (!items?.length) {
        container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucun objet</p></div>';
        return;
      }

      // Génère les QR codes via QRCode.js
      container.innerHTML = '';
      for (const item of items) {
        const wrapper = document.createElement('div');
        wrapper.className = 'qr-item';
        wrapper.dataset.itemId = item.id;

        const label = document.createElement('div');
        label.className = 'qr-code-label';
        label.innerHTML = `
          <div style="font-weight:600;font-size:11px">${Utils.escapeHtml(item.type)}</div>
          <div>${Utils.escapeHtml(item.qr_code)}</div>
        `;

        const qrDiv = document.createElement('div');
        qrDiv.id = `qr-${item.id}`;

        if (labelPos === 'above') {
          wrapper.appendChild(label);
          wrapper.appendChild(qrDiv);
        } else {
          wrapper.appendChild(qrDiv);
          wrapper.appendChild(label);
        }

        container.appendChild(wrapper);

        // Génère le QR code
        new QRCode(qrDiv, {
          text: item.qr_code,
          width: 120,
          height: 120,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    };

    await loadQRCodes();

    document.getElementById('refresh-qr-btn')?.addEventListener('click', loadQRCodes);
    document.getElementById('qr-label-pos')?.addEventListener('change', loadQRCodes);
    document.getElementById('qr-filter-status')?.addEventListener('change', loadQRCodes);
  },

  printQRPage() {
    window.print();
  },

  // ============================================================
  // UTILISATEURS (admin)
  // ============================================================
  async renderUsers() {
    const content = Pages.getMainContent();
    content.innerHTML = Pages.renderHeader('Gestion des comptes', `
      <button class="btn btn-primary btn-sm admin-only" id="add-user-btn">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Créer un compte
      </button>
    `) + `
      <div class="page-body">
        <div id="users-table">
          <div class="empty-state"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    const loadUsers = async () => {
      const { data, error } = await Users.getAll();
      const el = document.getElementById('users-table');
      if (!el) return;

      if (error || !data) {
        el.innerHTML = '<div class="alert alert-danger">Erreur de chargement</div>';
        return;
      }

      el.innerHTML = `
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Créé le</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${data.map(user => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px">
                      <div style="width:32px;height:32px;border-radius:50%;background:var(--c-accent-light);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;color:var(--c-accent)">
                        ${user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span style="font-weight:500">${Utils.escapeHtml(user.full_name)}</span>
                    </div>
                  </td>
                  <td class="text-muted text-sm">${Utils.escapeHtml(user.username)}</td>
                  <td>
                    <span class="badge ${user.role === 'admin' ? 'badge-info' : 'badge-available'}">
                      ${user.role === 'admin' ? 'Admin' : 'Utilisateur'}
                    </span>
                  </td>
                  <td>
                    <span class="badge ${user.is_active ? 'badge-available' : 'badge-loaned'}">
                      ${user.is_active ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td class="text-sm">${Utils.formatDate(user.created_at)}</td>
                  <td>
                    <div class="btn-group">
                      ${user.id !== Auth.currentUser.id ? `
                        <button class="btn btn-ghost btn-sm" onclick="Pages.toggleUser('${user.id}', ${!user.is_active})">
                          ${user.is_active ? '🔒 Désactiver' : '🔓 Activer'}
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="Pages.changeRole('${user.id}', '${user.role === 'admin' ? 'user' : 'admin'}')">
                          ${user.role === 'admin' ? '⬇ Utilisateur' : '⬆ Admin'}
                        </button>
                      ` : '<span class="text-xs text-muted">(Vous)</span>'}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    await loadUsers();

    document.getElementById('add-user-btn')?.addEventListener('click', () => {
      document.getElementById('new-user-email').value = '';
      document.getElementById('new-user-name').value = '';
      document.getElementById('new-user-pass').value = '';
      document.getElementById('new-user-role').value = 'user';
      UI.modal.open('add-user-modal');
    });

    Pages._loadUsers = loadUsers;
  },

  async toggleUser(userId, activate) {
    const { error } = await Users.toggle(userId, activate);
    if (error) UI.toast('Erreur', 'error');
    else {
      UI.toast(activate ? 'Compte activé' : 'Compte désactivé', 'success');
      Pages._loadUsers?.();
    }
  },

  async changeRole(userId, newRole) {
    const confirmed = await UI.confirm(`Changer le rôle vers "${newRole === 'admin' ? 'Administrateur' : 'Utilisateur'}" ?`);
    if (!confirmed) return;
    const { error } = await Users.setRole(userId, newRole);
    if (error) UI.toast('Erreur', 'error');
    else {
      UI.toast('Rôle modifié', 'success');
      Pages._loadUsers?.();
    }
  },

  // ============================================================
  // LOGS (admin)
  // ============================================================
  async renderLogs() {
    const content = Pages.getMainContent();
    content.innerHTML = Pages.renderHeader('Journal d\'activité') + `
      <div class="page-body">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" class="search-input" id="log-search" placeholder="Rechercher une action, un utilisateur..."/>
          </div>
          <select class="form-control" id="log-action" style="width:auto;min-width:180px">
            <option value="">Toutes les actions</option>
            <option value="LOGIN">Connexion</option>
            <option value="LOGOUT">Déconnexion</option>
            <option value="ITEM_CREATE">Création objet</option>
            <option value="ITEM_UPDATE">Modification objet</option>
            <option value="ITEM_DELETE">Suppression objet</option>
            <option value="LOAN_CREATE">Prêt</option>
            <option value="LOAN_RETURN">Restitution</option>
            <option value="USER_CREATE">Création compte</option>
          </select>
        </div>
        <div id="logs-table">
          <div class="empty-state"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    const loadLogs = async () => {
      const search = document.getElementById('log-search')?.value.trim() || '';
      const action = document.getElementById('log-action')?.value || '';

      let query = db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
      if (action) query = query.eq('action', action);
      if (search) query = query.or(`username.ilike.%${search}%,action.ilike.%${search}%`);

      const { data, error } = await query;
      const el = document.getElementById('logs-table');
      if (!el) return;

      if (error) {
        el.innerHTML = '<div class="alert alert-danger">Erreur de chargement</div>';
        return;
      }

      if (!data?.length) {
        el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p class="empty-state-text">Aucun log</p></div>';
        return;
      }

      const actionLabels = {
        LOGIN: ['🔓', 'Connexion'],
        LOGOUT: ['🔒', 'Déconnexion'],
        ITEM_CREATE: ['📦', 'Création objet'],
        ITEM_UPDATE: ['✏️', 'Modification objet'],
        ITEM_DELETE: ['🗑️', 'Suppression objet'],
        LOAN_CREATE: ['🔄', 'Prêt'],
        LOAN_RETURN: ['✅', 'Restitution'],
        USER_CREATE: ['👤', 'Création compte'],
        USER_ACTIVATE: ['🔓', 'Activation compte'],
        USER_DEACTIVATE: ['🔒', 'Désactivation compte'],
        USER_ROLE_CHANGE: ['⚙️', 'Changement rôle']
      };

      el.innerHTML = `
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>Date/Heure</th><th>Utilisateur</th><th>Action</th><th>Détails</th>
            </tr></thead>
            <tbody>
              ${data.map(log => {
                const [icon, label] = actionLabels[log.action] || ['📝', log.action];
                const details = log.details ? Object.entries(log.details)
                  .filter(([k]) => !['password'].includes(k))
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(', ') : '';
                return `<tr>
                  <td class="text-xs font-mono" style="white-space:nowrap">${Utils.formatDateTime(log.created_at)}</td>
                  <td style="font-weight:500">${Utils.escapeHtml(log.username || '—')}</td>
                  <td><span>${icon} ${label}</span></td>
                  <td class="text-xs text-muted">${Utils.escapeHtml(details)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    await loadLogs();

    document.getElementById('log-search')?.addEventListener('input', () => {
      clearTimeout(this._logTimer);
      this._logTimer = setTimeout(loadLogs, 300);
    });
    document.getElementById('log-action')?.addEventListener('change', loadLogs);
  }
};

// ============================================================
// HANDLERS DES FORMULAIRES MODAUX
// ============================================================

// Enregistrement objet
document.addEventListener('DOMContentLoaded', () => {
  // REGISTER ITEM
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('register-submit');
    UI.setLoading(btn, true);

    const qr = document.getElementById('register-qr').value.trim();
    const type = document.getElementById('register-type').value.trim();
    const location = document.getElementById('register-location').value.trim();

    if (!qr || !type || !location) {
      UI.toast('Code QR, type et lieu de stockage sont obligatoires', 'warning');
      UI.setLoading(btn, false);
      return;
    }

    const { error } = await Items.create({
      qr_code: qr,
      type,
      brand: document.getElementById('register-brand').value.trim(),
      model: document.getElementById('register-model').value.trim(),
      description: document.getElementById('register-desc').value.trim(),
      storage_location: location
    });

    UI.setLoading(btn, false);
    if (error) {
      UI.toast(error.code === '23505' ? 'Ce code QR existe déjà' : 'Erreur lors de l\'enregistrement', 'error');
    } else {
      UI.toast('Objet enregistré avec succès !', 'success');
      UI.modal.close('register-modal');
      if (App.currentPage === 'inventory') Pages.renderInventory();
    }
  });

  // LOAN FORM
  document.getElementById('loan-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loan-submit');
    UI.setLoading(btn, true);

    const itemId = document.getElementById('loan-item-id').value;
    const loanedTo = document.getElementById('loan-to').value.trim();
    const loanDate = document.getElementById('loan-date').value;

    if (!loanedTo || !loanDate) {
      UI.toast('Renseignez le destinataire et la date', 'warning');
      UI.setLoading(btn, false);
      return;
    }

    const { error } = await Loans.create({
      item_id: itemId,
      loaned_to: loanedTo,
      loan_date: loanDate,
      judicial_operation: document.getElementById('loan-operation').value.trim(),
      notes: document.getElementById('loan-notes').value.trim()
    });

    UI.setLoading(btn, false);
    if (error) {
      UI.toast('Erreur lors du prêt', 'error');
    } else {
      UI.toast('Prêt enregistré !', 'success');
      UI.modal.close('loan-modal');
      if (App.currentPage === 'inventory') Pages.renderInventory();
      if (App.currentPage === 'dashboard') Pages.renderDashboard();
    }
  });

  // RETURN FORM
  document.getElementById('return-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('return-submit');
    UI.setLoading(btn, true);

    const loanId = document.getElementById('return-loan-id').value;
    const itemId = document.getElementById('return-item-id').value;

    const { error } = await Loans.return(loanId, itemId, {
      return_notes: document.getElementById('return-notes').value.trim()
    });

    UI.setLoading(btn, false);
    if (error) {
      UI.toast('Erreur lors de la restitution', 'error');
    } else {
      UI.toast('Restitution enregistrée !', 'success');
      UI.modal.close('return-modal');
      if (App.currentPage === 'inventory') Pages.renderInventory();
      if (App.currentPage === 'dashboard') Pages.renderDashboard();
    }
  });

  // EDIT ITEM FORM
  document.getElementById('edit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('edit-submit');
    UI.setLoading(btn, true);

    const itemId = document.getElementById('edit-item-id').value;
    const { error } = await Items.update(itemId, {
      type: document.getElementById('edit-type').value.trim(),
      brand: document.getElementById('edit-brand').value.trim(),
      model: document.getElementById('edit-model').value.trim(),
      description: document.getElementById('edit-desc').value.trim(),
      storage_location: document.getElementById('edit-location').value.trim(),
      status: document.getElementById('edit-status').value
    });

    UI.setLoading(btn, false);
    if (error) {
      UI.toast('Erreur lors de la modification', 'error');
    } else {
      UI.toast('Objet modifié !', 'success');
      UI.modal.close('edit-modal');
      Pages.renderInventory();
    }
  });

  // ADD USER FORM
  document.getElementById('add-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('add-user-submit');
    UI.setLoading(btn, true);

    const email = document.getElementById('new-user-email').value.trim();
    const name = document.getElementById('new-user-name').value.trim();
    const pass = document.getElementById('new-user-pass').value;
    const role = document.getElementById('new-user-role').value;

    if (!email || !name || !pass) {
      UI.toast('Tous les champs sont obligatoires', 'warning');
      UI.setLoading(btn, false);
      return;
    }

    try {
      await Users.create(email, pass, name, role);
      UI.toast('Compte créé avec succès !', 'success');
      UI.modal.close('add-user-modal');
      Pages._loadUsers?.();
    } catch (e) {
      UI.toast('Erreur: ' + (e.message || 'Compte déjà existant'), 'error');
    }
    UI.setLoading(btn, false);
  });
});
