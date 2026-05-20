// ============================================================
// PAGES.JS - Toutes les pages (corrigé)
// ============================================================
const Pages = {

  getMainContent() { return document.getElementById('main-content'); },

  // ============================================================
  // LOGIN - FIX: navigation explicite, pas via onAuthStateChange
  // ============================================================
  renderLogin() {
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('qr-fab').style.display = 'none';
    const content = Pages.getMainContent();
    content.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-header">
            <div class="login-logo">🔐</div>
            <h1 class="login-title">Inventaire Judiciaire</h1>
            <p class="login-subtitle">Accès réservé aux personnels autorisés</p>
          </div>
          <div id="login-error" class="alert alert-danger hidden">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span id="login-error-msg">Identifiants incorrects</span>
          </div>
          <div class="form-group">
            <label class="form-label">Adresse e-mail</label>
            <input type="email" id="login-email" class="form-control" placeholder="prenom.nom@service.fr" autocomplete="email"/>
          </div>
          <div class="form-group">
            <label class="form-label">Mot de passe</label>
            <input type="password" id="login-password" class="form-control" placeholder="••••••••" autocomplete="current-password"/>
          </div>
          <button class="btn btn-primary btn-full btn-lg" id="login-btn">Se connecter</button>
          <p style="margin-top:20px;text-align:center;font-size:12px;color:var(--c-text-muted)">Système sécurisé — HTTPS requis</p>
        </div>
      </div>`;

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
      errorEl.classList.add('hidden');
      UI.setLoading(btn, true);
      try {
        await Auth.login(email, pass);
        // Navigation explicite après login réussi
        App.showApp();
        App.navigate('dashboard');
      } catch (e) {
        errorMsg.textContent = e.message?.includes('désactivé') ? 'Votre compte est désactivé.' : 'Identifiants incorrects';
        errorEl.classList.remove('hidden');
        UI.setLoading(btn, false);
      }
    };

    btn.addEventListener('click', doLogin);
    passEl.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    emailEl.addEventListener('keydown', e => { if (e.key === 'Enter') passEl.focus(); });
    setTimeout(() => emailEl.focus(), 100);
  },

  // ============================================================
  // DASHBOARD - FIX: join direct + stats cliquables
  // ============================================================
  async renderDashboard(params = {}) {
    document.getElementById('sidebar').style.display = '';
    document.getElementById('qr-fab').style.display = '';
    const content = Pages.getMainContent();

    content.innerHTML = `
      <div class="page-header">
        <button class="sidebar-toggle" id="sidebar-toggle">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <h1 class="page-header-title">Tableau de bord</h1>
      </div>
      <div class="page-body">
        <div class="stats-grid" id="stats-grid">
          <div class="stat-card"><div class="spinner"></div></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Prêts en cours</span></div>
          <div class="card-body" id="recent-loans">
            <div style="text-align:center;padding:20px"><div class="spinner"></div></div>
          </div>
        </div>
      </div>`;

    Pages._bindSidebarToggle();

    // Charge stats et prêts en parallèle
    const [allItemsRes, loansRes] = await Promise.all([
      Items.getAll(),
      Loans.getActiveFull(15)
    ]);

    const items = allItemsRes.data || [];
    const available = items.filter(i => i.status === 'available').length;
    const loaned = items.filter(i => i.status === 'loaned').length;
    const loans = loansRes.data || [];

    // Stats cliquables
    document.getElementById('stats-grid').innerHTML = `
      <button class="stat-card stat-clickable" onclick="App.navigate('inventory')">
        <div class="stat-icon" style="background:#E8EDF5;font-size:22px">📦</div>
        <div class="stat-info">
          <div class="stat-value">${items.length}</div>
          <div class="stat-label">Objets total</div>
        </div>
      </button>
      <button class="stat-card stat-clickable" onclick="App.navigate('inventory',{status:'available'})">
        <div class="stat-icon" style="background:var(--c-success-bg);font-size:22px">✅</div>
        <div class="stat-info">
          <div class="stat-value" style="color:var(--c-success)">${available}</div>
          <div class="stat-label">Disponibles</div>
        </div>
      </button>
      <button class="stat-card stat-clickable" onclick="App.navigate('inventory',{status:'loaned'})">
        <div class="stat-icon" style="background:var(--c-warning-bg);font-size:22px">🔄</div>
        <div class="stat-info">
          <div class="stat-value" style="color:var(--c-warning)">${loaned}</div>
          <div class="stat-label">En prêt</div>
        </div>
      </button>
      <button class="stat-card stat-clickable" onclick="App.navigate('inventory',{status:'loaned'})">
        <div class="stat-icon" style="background:var(--c-info-bg);font-size:22px">🔍</div>
        <div class="stat-info">
          <div class="stat-value" style="color:var(--c-info)">${loans.length}</div>
          <div class="stat-label">Prêts actifs</div>
        </div>
      </button>`;

    // Prêts actifs
    const recentEl = document.getElementById('recent-loans');
    if (!loans.length) {
      recentEl.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p class="empty-state-text">Aucun prêt actif</p>
        <p class="empty-state-sub">Scannez un QR code pour enregistrer un prêt</p>
      </div>`;
      return;
    }

    recentEl.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Objet</th><th>Prêté à</th><th>Opération</th><th>Date</th><th>Action</th>
          </tr></thead>
          <tbody>
            ${loans.map(loan => {
              const item = loan.items;
              return `<tr>
                <td>
                  <div style="font-weight:600">${Utils.escapeHtml(item?.brand || item?.type || '—')}</div>
                  <div class="text-xs text-muted font-mono">${Utils.escapeHtml(item?.qr_code || '')}</div>
                </td>
                <td>${Utils.escapeHtml(loan.loaned_to)}</td>
                <td class="text-sm">${Utils.escapeHtml(loan.judicial_operation || '—')}</td>
                <td class="text-sm" style="white-space:nowrap">${Utils.formatDate(loan.loan_date)}</td>
                <td>
                  <button class="btn btn-success btn-sm" onclick="Pages._quickReturn('${loan.id}','${item?.id}','${Utils.escapeHtml(item?.storage_location || '')}')">
                    ✅ Restituer
                  </button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  },

  // Restitution rapide depuis le dashboard
  async _quickReturn(loanId, itemId, storageLocation) {
    const confirmed = await UI.confirm(`Confirmer la restitution ?\n📍 Remettre à : ${storageLocation}`);
    if (!confirmed) return;
    const { error } = await Loans.return(loanId, itemId, { return_notes: '' });
    if (error) UI.toast('Erreur lors de la restitution', 'error');
    else { UI.toast('Restitution enregistrée !', 'success'); Pages.renderDashboard(); }
  },

  // ============================================================
  // INVENTAIRE - FIX: QR code cliquable + filtre par status initial
  // ============================================================
  async renderInventory(params = {}) {
    const content = Pages.getMainContent();
    content.innerHTML = `
      <div class="page-header">
        <button class="sidebar-toggle" id="sidebar-toggle">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <h1 class="page-header-title">Inventaire</h1>
        <button class="btn btn-primary btn-sm" id="add-item-btn">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Ajouter
        </button>
      </div>
      <div class="page-body">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" class="search-input" id="inv-search" placeholder="Code, type, marque, modèle..."/>
          </div>
          <select class="form-control" id="inv-status" style="width:auto;min-width:150px">
            <option value="">Tous les statuts</option>
            <option value="available" ${params.status === 'available' ? 'selected' : ''}>Disponible</option>
            <option value="loaned" ${params.status === 'loaned' ? 'selected' : ''}>En prêt</option>
          </select>
        </div>
        <div id="inventory-table"><div style="text-align:center;padding:30px"><div class="spinner"></div></div></div>
      </div>`;

    Pages._bindSidebarToggle();

    const load = async () => {
      const search = document.getElementById('inv-search')?.value.trim() || '';
      const status = document.getElementById('inv-status')?.value || '';
      const { data, error } = await Items.getAll({ search, status });
      const el = document.getElementById('inventory-table');
      if (!el) return;

      if (error) { el.innerHTML = '<div class="alert alert-danger">Erreur de chargement</div>'; return; }
      if (!data?.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div>
          <p class="empty-state-text">Aucun objet trouvé</p>
          <p class="empty-state-sub">Scannez un QR code pour enregistrer un objet</p></div>`;
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
                  <td>
                    <button class="qr-code-link font-mono text-xs" onclick="App.handleQRCode('${Utils.escapeHtml(item.qr_code)}')" title="Cliquer pour gérer cet objet">
                      ${Utils.escapeHtml(item.qr_code)}
                    </button>
                  </td>
                  <td>${Utils.escapeHtml(item.type)}</td>
                  <td>
                    <div style="font-weight:500">${Utils.escapeHtml(item.brand || '—')}</div>
                    <div class="text-xs text-muted">${Utils.escapeHtml(item.model || '')}</div>
                  </td>
                  <td class="text-sm">${Utils.escapeHtml(item.storage_location)}</td>
                  <td><span class="badge badge-${item.status === 'available' ? 'available' : 'loaned'}">
                    ${item.status === 'available' ? 'Disponible' : 'En prêt'}
                  </span></td>
                  <td>
                    <div class="btn-group">
                      <button class="btn btn-ghost btn-sm" onclick="Pages.openEditItem('${item.id}')">✏️</button>
                      ${Auth.isAdmin() ? `<button class="btn btn-ghost btn-sm" style="color:var(--c-danger)" onclick="Pages.deleteItem('${item.id}')">🗑</button>` : ''}
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    };

    await load();

    let searchTimer;
    document.getElementById('inv-search')?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(load, 300);
    });
    document.getElementById('inv-status')?.addEventListener('change', load);
    document.getElementById('add-item-btn')?.addEventListener('click', () => Pages.renderRegisterItem(''));
  },

  // ============================================================
  // FORMULAIRES QR
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

  renderLoanForm(item) {
    document.getElementById('loan-item-id').value = item.id;
    document.getElementById('loan-item-info').innerHTML = `
      <div class="alert alert-info" style="margin-bottom:16px">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <div>
          <strong>${Utils.escapeHtml(item.type)}${item.brand ? ' — ' + Utils.escapeHtml(item.brand) : ''}${item.model ? ' ' + Utils.escapeHtml(item.model) : ''}</strong><br>
          <span class="text-xs">QR: <code>${Utils.escapeHtml(item.qr_code)}</code> · Stockage: ${Utils.escapeHtml(item.storage_location)}</span>
        </div>
      </div>`;
    document.getElementById('loan-to').value = '';
    document.getElementById('loan-date').value = Utils.todayISO();
    document.getElementById('loan-operation').value = '';
    document.getElementById('loan-notes').value = '';
    UI.modal.open('loan-modal');

    const loanToEl = document.getElementById('loan-to');
    const opEl = document.getElementById('loan-operation');
    initAutocomplete(loanToEl, q => Autocomplete.getPersons(q));
    initAutocomplete(opEl, q => Autocomplete.getOperations(q));
    setTimeout(() => loanToEl.focus(), 200);
  },

  renderReturnForm(item, loan) {
    document.getElementById('return-item-id').value = item.id;
    document.getElementById('return-loan-id').value = loan?.id || '';
    document.getElementById('return-date').value = Utils.todayISO();
    document.getElementById('return-notes').value = '';
    document.getElementById('return-item-info').innerHTML = `
      <div class="alert alert-warning" style="margin-bottom:16px">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        <div>
          <strong>Objet en prêt · ${Utils.escapeHtml(item.type)}${item.brand ? ' — ' + Utils.escapeHtml(item.brand) : ''}</strong><br>
          <span class="text-xs">Prêté à : <strong>${Utils.escapeHtml(loan?.loaned_to || '?')}</strong></span><br>
          ${loan?.judicial_operation ? `<span class="text-xs">Opération : ${Utils.escapeHtml(loan.judicial_operation)}</span><br>` : ''}
          ${loan?.loan_date ? `<span class="text-xs">Depuis le : ${Utils.formatDate(loan.loan_date)}</span><br>` : ''}
          <span class="text-xs" style="font-weight:600;color:var(--c-accent)">📍 Remettre à : ${Utils.escapeHtml(item.storage_location)}</span>
        </div>
      </div>`;
    UI.modal.open('return-modal');
  },

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
    else { UI.toast('Objet supprimé', 'success'); Pages.renderInventory(); }
  },

  // ============================================================
  // QR CODES - FIX: taille, position droite, codes vierges
  // ============================================================
  async renderQRCodes() {
    const content = Pages.getMainContent();
    content.innerHTML = `
      <div class="page-header no-print">
        <button class="sidebar-toggle" id="sidebar-toggle">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <h1 class="page-header-title">QR Codes</h1>
        <button class="btn btn-primary btn-sm no-print" onclick="window.print()">🖨️ Imprimer</button>
      </div>
      <div class="page-body">
        <!-- Onglets -->
        <div class="tab-bar no-print">
          <button class="tab-btn active" id="tab-linked" onclick="Pages._switchQRTab('linked')">Objets enregistrés</button>
          <button class="tab-btn" id="tab-blank" onclick="Pages._switchQRTab('blank')">Codes vierges</button>
        </div>

        <!-- OPTIONS OBJETS ENREGISTRÉS -->
        <div id="qr-tab-linked">
          <div class="card no-print" style="margin-bottom:16px">
            <div class="card-body">
              <div class="form-row" style="align-items:flex-end">
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Taille des QR codes</label>
                  <select class="form-control" id="qr-size">
                    <option value="80">Petit (80px)</option>
                    <option value="120" selected>Moyen (120px)</option>
                    <option value="160">Grand (160px)</option>
                    <option value="200">Très grand (200px)</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Position du code texte</label>
                  <select class="form-control" id="qr-label-pos">
                    <option value="below">En dessous</option>
                    <option value="right">À droite</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Filtrer</label>
                  <select class="form-control" id="qr-filter-status">
                    <option value="">Tous</option>
                    <option value="available">Disponible</option>
                    <option value="loaned">En prêt</option>
                  </select>
                </div>
                <div>
                  <button class="btn btn-secondary" id="refresh-qr-btn">🔄 Actualiser</button>
                </div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header no-print"><span class="card-title">Aperçu — Prêt à imprimer</span></div>
            <div class="card-body print-qr-area" id="qr-grid-linked">
              <div style="text-align:center;padding:30px"><div class="spinner"></div></div>
            </div>
          </div>
        </div>

        <!-- OPTIONS CODES VIERGES -->
        <div id="qr-tab-blank" style="display:none">
          <div class="card no-print" style="margin-bottom:16px">
            <div class="card-body">
              <div class="form-row" style="align-items:flex-end">
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Nombre de codes à générer</label>
                  <input type="number" class="form-control" id="blank-count" value="20" min="1" max="200"/>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Préfixe</label>
                  <input type="text" class="form-control" id="blank-prefix" value="INV" maxlength="10" style="font-family:monospace"/>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Taille</label>
                  <select class="form-control" id="blank-size">
                    <option value="80">Petit (80px)</option>
                    <option value="120" selected>Moyen (120px)</option>
                    <option value="160">Grand (160px)</option>
                    <option value="200">Très grand (200px)</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Code texte</label>
                  <select class="form-control" id="blank-label-pos">
                    <option value="below">En dessous</option>
                    <option value="right">À droite</option>
                  </select>
                </div>
                <div>
                  <button class="btn btn-primary" id="generate-blank-btn">⚡ Générer</button>
                </div>
              </div>
              <div class="alert alert-info" style="margin-top:16px;margin-bottom:0">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Ces codes ne sont pas encore rattachés à un objet. Imprimez-les, collez-les sur vos équipements, puis scannez-les pour les enregistrer.
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header no-print"><span class="card-title">Codes vierges — Prêts à imprimer</span></div>
            <div class="card-body print-qr-area" id="qr-grid-blank">
              <div class="empty-state"><p class="empty-state-text">Cliquez sur "Générer" pour créer les codes</p></div>
            </div>
          </div>
        </div>
      </div>`;

    Pages._bindSidebarToggle();
    await Pages._loadLinkedQRCodes();

    document.getElementById('refresh-qr-btn')?.addEventListener('click', Pages._loadLinkedQRCodes);
    document.getElementById('qr-size')?.addEventListener('change', Pages._loadLinkedQRCodes);
    document.getElementById('qr-label-pos')?.addEventListener('change', Pages._loadLinkedQRCodes);
    document.getElementById('qr-filter-status')?.addEventListener('change', Pages._loadLinkedQRCodes);
    document.getElementById('generate-blank-btn')?.addEventListener('click', Pages._generateBlankQRCodes);
  },

  _switchQRTab(tab) {
    document.getElementById('qr-tab-linked').style.display = tab === 'linked' ? '' : 'none';
    document.getElementById('qr-tab-blank').style.display = tab === 'blank' ? '' : 'none';
    document.getElementById('tab-linked').classList.toggle('active', tab === 'linked');
    document.getElementById('tab-blank').classList.toggle('active', tab === 'blank');
  },

  async _loadLinkedQRCodes() {
    const size = parseInt(document.getElementById('qr-size')?.value || '120');
    const labelPos = document.getElementById('qr-label-pos')?.value || 'below';
    const status = document.getElementById('qr-filter-status')?.value || '';

    const { data: items } = await Items.getAll({ status });
    const container = document.getElementById('qr-grid-linked');
    if (!container) return;

    if (!items?.length) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucun objet</p></div>';
      return;
    }

    container.innerHTML = '';
    Pages._renderQRGrid(container, items.map(i => ({
      code: i.qr_code,
      label1: i.type,
      label2: i.brand ? `${i.brand}${i.model ? ' ' + i.model : ''}` : ''
    })), size, labelPos);
  },

  _generateBlankQRCodes() {
    const count = Math.min(parseInt(document.getElementById('blank-count')?.value || '20'), 200);
    const prefix = (document.getElementById('blank-prefix')?.value || 'INV').trim().toUpperCase();
    const size = parseInt(document.getElementById('blank-size')?.value || '120');
    const labelPos = document.getElementById('blank-label-pos')?.value || 'below';

    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push({ code: Utils.generateQR(prefix), label1: '', label2: '' });
    }

    const container = document.getElementById('qr-grid-blank');
    if (!container) return;
    container.innerHTML = '';
    Pages._renderQRGrid(container, codes, size, labelPos);
  },

  _renderQRGrid(container, items, size, labelPos) {
    // Calcule le nb de colonnes selon taille
    const cols = labelPos === 'right' ? Math.floor(550 / (size + 120)) : Math.floor(550 / (size + 16));
    container.style.display = 'grid';
    container.style.gridTemplateColumns = `repeat(auto-fill, minmax(${labelPos === 'right' ? size + 110 : size + 16}px, 1fr))`;
    container.style.gap = '12px';

    items.forEach(({ code, label1, label2 }) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'qr-item';
      wrapper.style.flexDirection = labelPos === 'right' ? 'row' : 'column';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = labelPos === 'right' ? '8px' : '4px';

      const qrDiv = document.createElement('div');
      qrDiv.style.flexShrink = '0';

      const label = document.createElement('div');
      label.className = 'qr-code-label';
      label.style.textAlign = labelPos === 'right' ? 'left' : 'center';
      label.innerHTML = [
        label1 ? `<div style="font-weight:600;font-size:11px">${Utils.escapeHtml(label1)}</div>` : '',
        label2 ? `<div style="font-size:10px;color:var(--c-text-muted)">${Utils.escapeHtml(label2)}</div>` : '',
        `<div class="font-mono" style="font-size:10px;margin-top:2px">${Utils.escapeHtml(code)}</div>`
      ].join('');

      if (labelPos === 'right') {
        wrapper.appendChild(qrDiv);
        wrapper.appendChild(label);
      } else {
        wrapper.appendChild(qrDiv);
        wrapper.appendChild(label);
      }

      container.appendChild(wrapper);

      new QRCode(qrDiv, {
        text: code,
        width: size,
        height: size,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    });
  },

  // ============================================================
  // UTILISATEURS - FIX: signUp + note désactivation email
  // ============================================================
  async renderUsers() {
    const content = Pages.getMainContent();
    content.innerHTML = `
      <div class="page-header">
        <button class="sidebar-toggle" id="sidebar-toggle">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <h1 class="page-header-title">Gestion des comptes</h1>
        <button class="btn btn-primary btn-sm" id="add-user-btn">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Créer un compte
        </button>
      </div>
      <div class="page-body">
        <div class="alert alert-info no-print" style="margin-bottom:16px">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div>Pour que la création de comptes fonctionne, désactivez la confirmation email dans Supabase :
          <strong>Authentication → Settings → "Confirm email" → désactiver</strong></div>
        </div>
        <div id="users-table"><div style="text-align:center;padding:30px"><div class="spinner"></div></div></div>
      </div>`;

    Pages._bindSidebarToggle();
    await Pages._loadUsers();

    document.getElementById('add-user-btn')?.addEventListener('click', () => {
      document.getElementById('new-user-email').value = '';
      document.getElementById('new-user-name').value = '';
      document.getElementById('new-user-pass').value = '';
      document.getElementById('new-user-role').value = 'user';
      UI.modal.open('add-user-modal');
    });
  },

  async _loadUsers() {
    const { data, error } = await Users.getAll();
    const el = document.getElementById('users-table');
    if (!el) return;

    if (error || !data) { el.innerHTML = '<div class="alert alert-danger">Erreur de chargement</div>'; return; }

    el.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Statut</th><th>Créé le</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${data.map(user => `<tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:32px;height:32px;border-radius:50%;background:var(--c-accent-light);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:var(--c-accent);flex-shrink:0">
                    ${user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <span style="font-weight:500">${Utils.escapeHtml(user.full_name)}</span>
                </div>
              </td>
              <td class="text-sm text-muted font-mono">${Utils.escapeHtml(user.username)}</td>
              <td><span class="badge ${user.role === 'admin' ? 'badge-info' : 'badge-available'}">${user.role === 'admin' ? '⚙️ Admin' : '👤 Utilisateur'}</span></td>
              <td><span class="badge ${user.is_active ? 'badge-available' : 'badge-loaned'}">${user.is_active ? 'Actif' : 'Désactivé'}</span></td>
              <td class="text-sm" style="white-space:nowrap">${Utils.formatDate(user.created_at)}</td>
              <td>
                ${user.id !== Auth.currentUser.id ? `
                  <div class="btn-group">
                    <button class="btn btn-ghost btn-sm" onclick="Pages._toggleUser('${user.id}',${!user.is_active})">
                      ${user.is_active ? '🔒' : '🔓'}
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="Pages._changeRole('${user.id}','${user.role === 'admin' ? 'user' : 'admin'}')">
                      ${user.role === 'admin' ? '⬇ User' : '⬆ Admin'}
                    </button>
                  </div>` : '<span class="text-xs text-muted">(Vous)</span>'}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  },

  async _toggleUser(userId, activate) {
    const { error } = await Users.toggle(userId, activate);
    if (error) UI.toast('Erreur', 'error');
    else { UI.toast(activate ? 'Compte activé' : 'Compte désactivé', 'success'); Pages._loadUsers(); }
  },

  async _changeRole(userId, newRole) {
    const label = newRole === 'admin' ? 'Administrateur' : 'Utilisateur';
    const confirmed = await UI.confirm(`Changer le rôle vers "${label}" ?`);
    if (!confirmed) return;
    const { error } = await Users.setRole(userId, newRole);
    if (error) UI.toast('Erreur', 'error');
    else { UI.toast('Rôle modifié', 'success'); Pages._loadUsers(); }
  },

  // ============================================================
  // LOGS
  // ============================================================
  async renderLogs() {
    const content = Pages.getMainContent();
    content.innerHTML = `
      <div class="page-header">
        <button class="sidebar-toggle" id="sidebar-toggle">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <h1 class="page-header-title">Journal d'activité</h1>
      </div>
      <div class="page-body">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" class="search-input" id="log-search" placeholder="Utilisateur, action..."/>
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
        <div id="logs-table"><div style="text-align:center;padding:30px"><div class="spinner"></div></div></div>
      </div>`;

    Pages._bindSidebarToggle();

    const loadLogs = async () => {
      const search = document.getElementById('log-search')?.value.trim() || '';
      const action = document.getElementById('log-action')?.value || '';
      let query = db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
      if (action) query = query.eq('action', action);
      if (search) query = query.or(`username.ilike.%${search}%,action.ilike.%${search}%`);

      const { data, error } = await query;
      const el = document.getElementById('logs-table');
      if (!el) return;

      if (error) { el.innerHTML = '<div class="alert alert-danger">Erreur de chargement</div>'; return; }
      if (!data?.length) {
        el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p class="empty-state-text">Aucun log</p></div>';
        return;
      }

      const actionLabels = {
        LOGIN: '🔓', LOGOUT: '🔒',
        ITEM_CREATE: '📦+', ITEM_UPDATE: '✏️', ITEM_DELETE: '🗑️',
        LOAN_CREATE: '🔄', LOAN_RETURN: '✅',
        USER_CREATE: '👤+', USER_ACTIVATE: '🔓', USER_DEACTIVATE: '🔒', USER_ROLE_CHANGE: '⚙️'
      };
      const actionNames = {
        LOGIN: 'Connexion', LOGOUT: 'Déconnexion',
        ITEM_CREATE: 'Création objet', ITEM_UPDATE: 'Modif objet', ITEM_DELETE: 'Suppr objet',
        LOAN_CREATE: 'Prêt', LOAN_RETURN: 'Restitution',
        USER_CREATE: 'Création compte', USER_ACTIVATE: 'Activation', USER_DEACTIVATE: 'Désactivation', USER_ROLE_CHANGE: 'Changement rôle'
      };

      el.innerHTML = `
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Date/Heure</th><th>Utilisateur</th><th>Action</th><th>Détails</th></tr></thead>
            <tbody>
              ${data.map(log => {
                const details = log.details ? Object.entries(log.details)
                  .filter(([k]) => !['password'].includes(k))
                  .map(([k, v]) => `${k}: ${v}`).join(', ') : '';
                return `<tr>
                  <td class="text-xs font-mono" style="white-space:nowrap">${Utils.formatDateTime(log.created_at)}</td>
                  <td style="font-weight:500">${Utils.escapeHtml(log.username || '—')}</td>
                  <td>${actionLabels[log.action] || '📝'} <span class="text-sm">${actionNames[log.action] || log.action}</span></td>
                  <td class="text-xs text-muted">${Utils.escapeHtml(details)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    };

    await loadLogs();

    let logTimer;
    document.getElementById('log-search')?.addEventListener('input', () => {
      clearTimeout(logTimer); logTimer = setTimeout(loadLogs, 300);
    });
    document.getElementById('log-action')?.addEventListener('change', loadLogs);
  },

  // Helper : re-bind toggle sidebar après chaque rendu de page
  _bindSidebarToggle() {
    setTimeout(() => {
      document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebar-overlay').classList.toggle('open');
      });
    }, 0);
  }
};

// ============================================================
// HANDLERS FORMULAIRES
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // REGISTER
  document.getElementById('register-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('register-submit');
    const qr = document.getElementById('register-qr').value.trim();
    const type = document.getElementById('register-type').value.trim();
    const location = document.getElementById('register-location').value.trim();
    if (!qr || !type || !location) { UI.toast('Code QR, type et lieu sont obligatoires', 'warning'); return; }
    UI.setLoading(btn, true);
    const { error } = await Items.create({
      qr_code: qr, type,
      brand: document.getElementById('register-brand').value.trim(),
      model: document.getElementById('register-model').value.trim(),
      description: document.getElementById('register-desc').value.trim(),
      storage_location: location
    });
    UI.setLoading(btn, false);
    if (error) UI.toast(error.code === '23505' ? 'Ce code QR existe déjà' : 'Erreur : ' + error.message, 'error');
    else { UI.toast('Objet enregistré !', 'success'); UI.modal.close('register-modal'); if (App.currentPage === 'inventory') Pages.renderInventory(); }
  });

  // LOAN
  document.getElementById('loan-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('loan-submit');
    const itemId = document.getElementById('loan-item-id').value;
    const loanedTo = document.getElementById('loan-to').value.trim();
    const loanDate = document.getElementById('loan-date').value;
    if (!loanedTo || !loanDate) { UI.toast('Renseignez le destinataire et la date', 'warning'); return; }
    UI.setLoading(btn, true);
    const { error } = await Loans.create({
      item_id: itemId, loaned_to: loanedTo, loan_date: loanDate,
      judicial_operation: document.getElementById('loan-operation').value.trim(),
      notes: document.getElementById('loan-notes').value.trim()
    });
    UI.setLoading(btn, false);
    if (error) UI.toast('Erreur : ' + error.message, 'error');
    else {
      UI.toast('Prêt enregistré !', 'success'); UI.modal.close('loan-modal');
      if (App.currentPage === 'inventory') Pages.renderInventory();
      if (App.currentPage === 'dashboard') Pages.renderDashboard();
    }
  });

  // RETURN
  document.getElementById('return-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('return-submit');
    UI.setLoading(btn, true);
    const { error } = await Loans.return(
      document.getElementById('return-loan-id').value,
      document.getElementById('return-item-id').value,
      { return_notes: document.getElementById('return-notes').value.trim() }
    );
    UI.setLoading(btn, false);
    if (error) UI.toast('Erreur : ' + error.message, 'error');
    else {
      UI.toast('Restitution enregistrée !', 'success'); UI.modal.close('return-modal');
      if (App.currentPage === 'inventory') Pages.renderInventory();
      if (App.currentPage === 'dashboard') Pages.renderDashboard();
    }
  });

  // EDIT
  document.getElementById('edit-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('edit-submit');
    UI.setLoading(btn, true);
    const { error } = await Items.update(document.getElementById('edit-item-id').value, {
      type: document.getElementById('edit-type').value.trim(),
      brand: document.getElementById('edit-brand').value.trim(),
      model: document.getElementById('edit-model').value.trim(),
      description: document.getElementById('edit-desc').value.trim(),
      storage_location: document.getElementById('edit-location').value.trim(),
      status: document.getElementById('edit-status').value
    });
    UI.setLoading(btn, false);
    if (error) UI.toast('Erreur : ' + error.message, 'error');
    else { UI.toast('Objet modifié !', 'success'); UI.modal.close('edit-modal'); Pages.renderInventory(); }
  });

  // ADD USER
  document.getElementById('add-user-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('add-user-submit');
    const email = document.getElementById('new-user-email').value.trim();
    const name = document.getElementById('new-user-name').value.trim();
    const pass = document.getElementById('new-user-pass').value;
    const role = document.getElementById('new-user-role').value;
    if (!email || !name || !pass) { UI.toast('Tous les champs sont obligatoires', 'warning'); return; }
    if (pass.length < 6) { UI.toast('Mot de passe trop court (min. 6 caractères)', 'warning'); return; }
    UI.setLoading(btn, true);
    try {
      await Users.create(email, pass, name, role);
      UI.toast('Compte créé avec succès !', 'success');
      UI.modal.close('add-user-modal');
      Pages._loadUsers();
    } catch (err) {
      const msg = err.message?.includes('already') ? 'Cet email est déjà utilisé'
        : err.message?.includes('email') ? 'Désactivez la confirmation email dans Supabase Auth Settings'
        : 'Erreur : ' + err.message;
      UI.toast(msg, 'error');
    }
    UI.setLoading(btn, false);
  });
});
