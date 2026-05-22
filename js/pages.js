// ============================================================
// PAGES.JS
// ============================================================
const Pages = {

  getMainContent() { return document.getElementById('main-content'); },


  // ============================================================
  // LOGIN
  // ============================================================
  // Affiché quand l'utilisateur arrive via un lien de reset Supabase
  renderPasswordRecovery() {
    Pages.getMainContent().innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-header">
            <div class="login-logo">🔑</div>
            <h1 class="login-title">Nouveau mot de passe</h1>
            <p class="login-subtitle">Choisissez un nouveau mot de passe pour votre compte</p>
          </div>
          <div id="rec-error" class="alert alert-danger hidden">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span id="rec-error-msg"></span>
          </div>
          <div class="form-group">
            <label class="form-label">Nouveau mot de passe <span class="required">*</span></label>
            <input type="password" id="rec-new" class="form-control" placeholder="Minimum 6 caractères" minlength="6" autofocus/>
          </div>
          <div class="form-group">
            <label class="form-label">Confirmer <span class="required">*</span></label>
            <input type="password" id="rec-confirm" class="form-control" placeholder="••••••••" minlength="6"/>
          </div>
          <button class="btn btn-primary btn-full btn-lg" id="rec-btn">✅ Enregistrer le mot de passe</button>
        </div>
      </div>`;

    const btn = document.getElementById('rec-btn');
    const errorEl = document.getElementById('rec-error');
    const errorMsg = document.getElementById('rec-error-msg');

    const doReset = async () => {
      const newPass = document.getElementById('rec-new').value;
      const confirm = document.getElementById('rec-confirm').value;
      errorEl.classList.add('hidden');
      if (newPass.length < 6) { errorMsg.textContent = 'Minimum 6 caractères'; errorEl.classList.remove('hidden'); return; }
      if (newPass !== confirm) { errorMsg.textContent = 'Les mots de passe ne correspondent pas'; errorEl.classList.remove('hidden'); return; }
      UI.setLoading(btn, true);
      const { error } = await db.auth.updateUser({ password: newPass });
      if (error) {
        errorMsg.textContent = error.message;
        errorEl.classList.remove('hidden');
        UI.setLoading(btn, false);
        return;
      }
      await db.auth.signOut();
      UI.toast('Mot de passe modifié ! Reconnectez-vous.', 'success');
      App.init();
    };

    btn.addEventListener('click', doReset);
    document.getElementById('rec-confirm').addEventListener('keydown', e => { if (e.key === 'Enter') doReset(); });
  },

  renderLogin() {
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('main-content').style.marginLeft = '0';
    document.getElementById('qr-fab').style.display = 'none';
    Pages.getMainContent().innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-header">
            <div class="login-logo">🔐</div>
            <h1 class="login-title">Gestion de Matériels</h1>
            <p class="login-subtitle">Accès réservé aux personnels autorisés</p>
          </div>
          <div id="login-error" class="alert alert-danger hidden">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span id="login-error-msg"></span>
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
        </div>
      </div>`;

    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-password');
    const btn = document.getElementById('login-btn');
    const errorEl = document.getElementById('login-error');
    const errorMsg = document.getElementById('login-error-msg');

    const doLogin = async () => {
      const email = emailEl.value.trim(), pass = passEl.value;
      if (!email || !pass) { errorMsg.textContent = 'Veuillez remplir tous les champs'; errorEl.classList.remove('hidden'); return; }
      errorEl.classList.add('hidden');
      UI.setLoading(btn, true);
      try {
        await Auth.login(email, pass);
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
    setTimeout(() => {
      initDomainAutofill(emailEl);
      emailEl.focus();
    }, 100);
  },

  // ============================================================
  // DASHBOARD - avec onglet "En retard"
  // ============================================================
  async renderDashboard() {
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
          <div class="card-header" style="gap:0;flex-direction:column;align-items:flex-start;padding-bottom:0">
            <div class="tab-bar" style="margin:12px 0 0 0;border:none;background:none;padding:0;gap:0">
              <button class="tab-btn active" id="tab-active" onclick="Pages._switchDashTab('active')">Prêts en cours</button>
              <button class="tab-btn" id="tab-overdue" onclick="Pages._switchDashTab('overdue')">
                ⚠️ En retard <span id="overdue-badge" class="overdue-count" style="display:none"></span>
              </button>
            </div>
          </div>
          <div class="card-body" style="padding-top:12px">
            <div id="loans-panel-active"></div>
            <div id="loans-panel-overdue" style="display:none"></div>
          </div>
        </div>
      </div>`;


    const [allItemsRes, loansRes] = await Promise.all([Items.getAll(), Loans.getActiveFull(100)]);
    const items = allItemsRes.data || [];
    const loans = loansRes.data || [];
    const available = items.filter(i => i.status === 'available').length;
    const loaned = items.filter(i => i.status === 'loaned').length;
    const overdue = loans.filter(l => l.expected_return_date && Utils.isOverdue(l.expected_return_date));

    // Badge retard
    if (overdue.length > 0) {
      const badge = document.getElementById('overdue-badge');
      if (badge) { badge.textContent = overdue.length; badge.style.display = ''; }
    }

    // Stats
    document.getElementById('stats-grid').innerHTML = `
      <button class="stat-card stat-clickable" onclick="App.navigate('inventory')">
        <div class="stat-icon" style="background:#E8EDF5">📦</div>
        <div class="stat-info"><div class="stat-value">${items.length}</div><div class="stat-label">Total</div></div>
      </button>
      <button class="stat-card stat-clickable" onclick="App.navigate('inventory',{status:'available'})">
        <div class="stat-icon" style="background:var(--c-success-bg)">✅</div>
        <div class="stat-info"><div class="stat-value" style="color:var(--c-success)">${available}</div><div class="stat-label">Disponibles</div></div>
      </button>
      <button class="stat-card stat-clickable" onclick="App.navigate('inventory',{status:'loaned'})">
        <div class="stat-icon" style="background:var(--c-warning-bg)">🔄</div>
        <div class="stat-info"><div class="stat-value" style="color:var(--c-warning)">${loaned}</div><div class="stat-label">En prêt</div></div>
      </button>
      <button class="stat-card stat-clickable ${overdue.length ? 'stat-overdue' : ''}" onclick="Pages._switchDashTab('overdue')">
        <div class="stat-icon" style="background:${overdue.length ? 'var(--c-danger-bg)' : 'var(--c-surface-2)'}">⚠️</div>
        <div class="stat-info">
          <div class="stat-value" style="color:${overdue.length ? 'var(--c-danger)' : 'var(--c-text-muted)'}">${overdue.length}</div>
          <div class="stat-label">En retard</div>
        </div>
      </button>`;

    Pages._renderLoanTable(loans, overdue);
  },

  _switchDashTab(tab) {
    document.getElementById('tab-active').classList.toggle('active', tab === 'active');
    document.getElementById('tab-overdue').classList.toggle('active', tab === 'overdue');
    document.getElementById('loans-panel-active').style.display = tab === 'active' ? '' : 'none';
    document.getElementById('loans-panel-overdue').style.display = tab === 'overdue' ? '' : 'none';
  },

  _renderLoanTable(loans, overdue) {
    const renderRows = (list) => {
      if (!list.length) return `<div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p class="empty-state-text">Aucun prêt dans cette catégorie</p>
      </div>`;

      return `<div class="table-wrapper"><table>
        <thead><tr>
          <th>Objet</th><th>Prêté à</th><th>Opération</th>
          <th>Depuis</th><th>Restitution prévue</th><th>Action</th>
        </tr></thead>
        <tbody>${list.map(loan => {
          const item = loan.items;
          const od = loan.expected_return_date && Utils.isOverdue(loan.expected_return_date);
          const days = od ? Utils.daysOverdue(loan.expected_return_date) : 0;
          return `<tr class="${od ? 'row-overdue' : ''}">
            <td>
              <div style="font-weight:600">${Utils.escapeHtml(item?.brand || item?.type || '—')}</div>
              <div class="text-xs text-muted font-mono">${Utils.escapeHtml(item?.qr_code || '')}</div>
            </td>
            <td>${Utils.escapeHtml(loan.loaned_to)}</td>
            <td class="text-sm">${Utils.escapeHtml(loan.judicial_operation || '—')}</td>
            <td class="text-sm" style="white-space:nowrap">${Utils.formatDate(loan.loan_date)}</td>
            <td style="white-space:nowrap">
              ${loan.expected_return_date
                ? `<span class="${od ? 'overdue-label' : 'text-sm'}">${Utils.formatDate(loan.expected_return_date)}${od ? ` <strong>(+${days}j)</strong>` : ''}</span>`
                : '<span class="text-muted text-xs">—</span>'}
            </td>
            <td>
              <button class="btn btn-success btn-sm" onclick="Pages._quickReturn('${loan.id}','${item?.id}','${Utils.escapeHtml(item?.storage_location||'Non précisé')}')">✅</button>
            </td>
          </tr>`;
        }).join('')}</tbody></table></div>`;
    };

    const activeLoans = loans.filter(l => !l.expected_return_date || !Utils.isOverdue(l.expected_return_date));
    document.getElementById('loans-panel-active').innerHTML = renderRows(activeLoans);
    document.getElementById('loans-panel-overdue').innerHTML = renderRows(overdue);
  },

  async _quickReturn(loanId, itemId, storageLocation) {
    const confirmed = await UI.confirm(`Confirmer la restitution ?\n📍 Remettre à : ${storageLocation || 'lieu non défini'}`);
    if (!confirmed) return;
    const { error } = await Loans.return(loanId, itemId, { return_notes: '' });
    if (error) UI.toast('Erreur lors de la restitution', 'error');
    else { UI.toast('Restitution enregistrée !', 'success'); Pages.renderDashboard(); }
  },

  // ============================================================
  // INVENTAIRE
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
            <option value="available" ${params.status==='available'?'selected':''}>Disponible</option>
            <option value="loaned" ${params.status==='loaned'?'selected':''}>En prêt</option>
          </select>
        </div>
        <div id="inventory-table"><div style="text-align:center;padding:30px"><div class="spinner"></div></div></div>
      </div>`;


    const load = async () => {
      const search = document.getElementById('inv-search')?.value.trim() || '';
      const status = document.getElementById('inv-status')?.value || '';
      const { data, error } = await Items.getAll({ search, status });
      const el = document.getElementById('inventory-table');
      if (!el) return;
      if (error) { el.innerHTML = '<div class="alert alert-danger">Erreur de chargement</div>'; return; }
      if (!data?.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><p class="empty-state-text">Aucun objet trouvé</p></div>`;
        return;
      }
      el.innerHTML = `<div class="table-wrapper"><table>
        <thead><tr>
          <th>Code QR</th><th>Type</th><th>Marque / Modèle</th>
          <th class="hide-mobile">Stockage</th><th>Statut</th><th>Actions</th>
        </tr></thead>
        <tbody>${data.map(item => `<tr>
          <td><button class="qr-code-link font-mono" onclick="App.handleQRCode('${Utils.escapeHtml(item.qr_code)}')" title="Gérer cet objet">${Utils.escapeHtml(item.qr_code)}</button></td>
          <td class="text-sm">${Utils.escapeHtml(item.type)}</td>
          <td>
            <div style="font-weight:500">${Utils.escapeHtml(item.brand||'—')}</div>
            <div class="text-xs text-muted">${Utils.escapeHtml(item.model||'')}</div>
          </td>
          <td class="text-sm hide-mobile">${Utils.escapeHtml(item.storage_location||'Non précisé')}</td>
          <td><span class="badge badge-${item.status==='available'?'available':'loaned'}">${item.status==='available'?'Disponible':'En prêt'}</span></td>
          <td>
            <div class="btn-group">
              <button class="btn btn-ghost btn-sm" onclick="Pages.openEditItem('${item.id}')">✏️</button>
              ${Auth.isAdmin()?`<button class="btn btn-ghost btn-sm" style="color:var(--c-danger)" onclick="Pages.deleteItem('${item.id}')">🗑</button>`:''}
            </div>
          </td>
        </tr>`).join('')}</tbody></table></div>`;
    };

    await load();
    let st;
    document.getElementById('inv-search')?.addEventListener('input', () => { clearTimeout(st); st = setTimeout(load,300); });
    document.getElementById('inv-status')?.addEventListener('change', load);
    document.getElementById('add-item-btn')?.addEventListener('click', () => Pages.renderRegisterItem(''));
  },

  // ============================================================
  // ENREGISTREMENT OBJET - lieu non obligatoire, type avec picker
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
  // PRÊT - avec date de restitution optionnelle
  // ============================================================
  renderLoanForm(item) {
    document.getElementById('loan-item-id').value = item.id;
    document.getElementById('loan-item-info').innerHTML = `
      <div class="alert alert-info" style="margin-bottom:16px">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <div>
          <strong>${Utils.escapeHtml(item.type)}${item.brand?' — '+Utils.escapeHtml(item.brand):''}${item.model?' '+Utils.escapeHtml(item.model):''}</strong><br>
          <span class="text-xs">QR : <code>${Utils.escapeHtml(item.qr_code)}</code>${' · Stockage : '+(item.storage_location?Utils.escapeHtml(item.storage_location):'Non précisé')}</span>
        </div>
      </div>`;
    document.getElementById('loan-to').value = '';
    document.getElementById('loan-date').value = Utils.todayISO();
    document.getElementById('loan-expected-return').value = '';
    document.getElementById('loan-operation').value = '';
    document.getElementById('loan-notes').value = '';
    UI.modal.open('loan-modal');
    const loanToEl = document.getElementById('loan-to');
    const opEl = document.getElementById('loan-operation');
    initAutocomplete(loanToEl, q => Autocomplete.getPersons(q));
    initAutocomplete(opEl, q => Autocomplete.getOperations(q));
    setTimeout(() => loanToEl.focus(), 200);
  },

  // ============================================================
  // RESTITUTION
  // ============================================================
  renderReturnForm(item, loan) {
    document.getElementById('return-item-id').value = item.id;
    document.getElementById('return-loan-id').value = loan?.id || '';
    document.getElementById('return-date').value = Utils.todayISO();
    document.getElementById('return-notes').value = '';
    const od = loan?.expected_return_date && Utils.isOverdue(loan.expected_return_date);
    document.getElementById('return-item-info').innerHTML = `
      <div class="alert alert-${od?'danger':'warning'}" style="margin-bottom:16px">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        <div>
          <strong>${Utils.escapeHtml(item.type)}${item.brand?' — '+Utils.escapeHtml(item.brand):''}</strong><br>
          <span class="text-xs">Prêté à : <strong>${Utils.escapeHtml(loan?.loaned_to||'?')}</strong></span><br>
          ${loan?.judicial_operation?`<span class="text-xs">Opération : ${Utils.escapeHtml(loan.judicial_operation)}</span><br>`:''}
          ${loan?.loan_date?`<span class="text-xs">Depuis le : ${Utils.formatDate(loan.loan_date)}</span><br>`:''}
          ${loan?.expected_return_date?`<span class="text-xs ${od?'overdue-label':''}">Restitution prévue : ${Utils.formatDate(loan.expected_return_date)}${od?` (+${Utils.daysOverdue(loan.expected_return_date)} j de retard)`:''}</span><br>`:''}
          <span class="text-xs" style="font-weight:600;color:var(--c-accent)">📍 Remettre à : ${Utils.escapeHtml(item.storage_location||'Non précisé')}</span>
        </div>
      </div>`;
    UI.modal.open('return-modal');
  },

  // ============================================================
  // MODIFIER OBJET
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
    document.getElementById('edit-location').value = item.storage_location || '';
    document.getElementById('edit-status').value = item.status;
    UI.modal.open('edit-modal');
  },

  async deleteItem(itemId) {
    const confirmed = await UI.confirm('Supprimer définitivement cet objet ?');
    if (!confirmed) return;
    const { error } = await Items.delete(itemId);
    if (error) UI.toast('Erreur suppression', 'error');
    else { UI.toast('Objet supprimé', 'success'); Pages.renderInventory(); }
  },

  // ============================================================
  // QR CODES
  // ============================================================
  async renderQRCodes() {
    const content = Pages.getMainContent();
    content.innerHTML = `
      <div class="page-header no-print">
        <button class="sidebar-toggle" id="sidebar-toggle">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <h1 class="page-header-title">QR Codes</h1>
        <div class="btn-group no-print">
          <button class="btn btn-secondary btn-sm" id="download-zip-btn">📥 Télécharger ZIP</button>
          <button class="btn btn-primary btn-sm" onclick="window.print()">🖨️ Imprimer</button>
        </div>
      </div>
      <div class="page-body">
        <div class="tab-bar no-print">
          <button class="tab-btn active" id="tab-linked" onclick="Pages._switchQRTab('linked')">Objets enregistrés</button>
          <button class="tab-btn" id="tab-blank" onclick="Pages._switchQRTab('blank')">Codes vierges</button>
        </div>

        <!-- OBJETS ENREGISTRÉS -->
        <div id="qr-tab-linked">
          <div class="card no-print" style="margin-bottom:16px">
            <div class="card-body">
              <div class="qr-options-grid">
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Taille</label>
                  <select class="form-control" id="qr-size">
                    <option value="55">Très petit (55px)</option>
                    <option value="80" selected>Petit (80px)</option>
                    <option value="110">Moyen (110px)</option>
                    <option value="150">Grand (150px)</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Position du code</label>
                  <select class="form-control" id="qr-label-pos">
                    <option value="below">En dessous</option>
                    <option value="right">À droite</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Statut</label>
                  <select class="form-control" id="qr-filter-status">
                    <option value="">Tous</option>
                    <option value="available">Disponible</option>
                    <option value="loaned">En prêt</option>
                  </select>
                </div>
                <div style="align-self:flex-end">
                  <button class="btn btn-secondary" id="refresh-qr-btn">🔄 Actualiser</button>
                </div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header no-print"><span class="card-title">Aperçu — Prêt à imprimer (A4)</span></div>
            <div class="card-body print-qr-area" id="qr-grid-linked">
              <div style="text-align:center;padding:30px"><div class="spinner"></div></div>
            </div>
          </div>
        </div>

        <!-- CODES VIERGES -->
        <div id="qr-tab-blank" style="display:none">
          <div class="card no-print" style="margin-bottom:16px">
            <div class="card-body">
              <div class="qr-options-grid">
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Nombre</label>
                  <input type="number" class="form-control" id="blank-count" value="20" min="1" max="200"/>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Préfixe</label>
                  <input type="text" class="form-control font-mono" id="blank-prefix" value="INV" maxlength="10"/>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Taille</label>
                  <select class="form-control" id="blank-size">
                    <option value="55">Très petit (55px)</option>
                    <option value="80" selected>Petit (80px)</option>
                    <option value="110">Moyen (110px)</option>
                    <option value="150">Grand (150px)</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Position du code</label>
                  <select class="form-control" id="blank-label-pos">
                    <option value="below">En dessous</option>
                    <option value="right">À droite</option>
                  </select>
                </div>
                <div style="align-self:flex-end">
                  <button class="btn btn-primary" id="generate-blank-btn">⚡ Générer</button>
                </div>
              </div>
              <div class="alert alert-info" style="margin-top:12px;margin-bottom:0">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Codes non rattachés à un objet. Collez-les sur vos équipements puis scannez pour les enregistrer.
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header no-print"><span class="card-title">Codes vierges</span></div>
            <div class="card-body print-qr-area" id="qr-grid-blank">
              <div class="empty-state"><p class="empty-state-text">Cliquez "Générer" pour créer les codes</p></div>
            </div>
          </div>
        </div>
      </div>`;

    await Pages._loadLinkedQRCodes();
    document.getElementById('refresh-qr-btn')?.addEventListener('click', Pages._loadLinkedQRCodes);
    document.getElementById('qr-size')?.addEventListener('change', Pages._loadLinkedQRCodes);
    document.getElementById('qr-label-pos')?.addEventListener('change', Pages._loadLinkedQRCodes);
    document.getElementById('qr-filter-status')?.addEventListener('change', Pages._loadLinkedQRCodes);
    document.getElementById('generate-blank-btn')?.addEventListener('click', Pages._generateBlankQRCodes);
    document.getElementById('download-zip-btn')?.addEventListener('click', Pages._downloadQRZip);
  },

  _switchQRTab(tab) {
    document.getElementById('qr-tab-linked').style.display = tab==='linked'?'':'none';
    document.getElementById('qr-tab-blank').style.display = tab==='blank'?'':'none';
    document.getElementById('tab-linked').classList.toggle('active', tab==='linked');
    document.getElementById('tab-blank').classList.toggle('active', tab==='blank');
  },

  async _loadLinkedQRCodes() {
    const size = parseInt(document.getElementById('qr-size')?.value||'80');
    const labelPos = document.getElementById('qr-label-pos')?.value||'below';
    const status = document.getElementById('qr-filter-status')?.value||'';
    const { data: items } = await Items.getAll({ status });
    const container = document.getElementById('qr-grid-linked');
    if (!container) return;
    if (!items?.length) { container.innerHTML='<div class="empty-state"><p class="empty-state-text">Aucun objet</p></div>'; return; }
    container.innerHTML = '';
    Pages._renderQRGrid(container, items.map(i=>({
      code: i.qr_code,
      label1: i.type,
      label2: i.brand?`${i.brand}${i.model?' '+i.model:''}`:'',
      label3: i.storage_location||''
    })), size, labelPos);
  },

  _generateBlankQRCodes() {
    const count = Math.min(parseInt(document.getElementById('blank-count')?.value||'20'),200);
    const prefix = (document.getElementById('blank-prefix')?.value||'INV').trim().toUpperCase();
    const size = parseInt(document.getElementById('blank-size')?.value||'80');
    const labelPos = document.getElementById('blank-label-pos')?.value||'below';
    const codes = Array.from({length:count},()=>({code:Utils.generateQR(prefix),label1:'',label2:'',label3:''}));
    const container = document.getElementById('qr-grid-blank');
    if (!container) return;
    container.innerHTML = '';
    Pages._renderQRGrid(container, codes, size, labelPos);
  },

  // Export ZIP : un PNG par QR code
  async _downloadQRZip() {
    const btn = document.getElementById('download-zip-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Génération...'; }

    // Détermine quel onglet est actif
    const isBlank = document.getElementById('qr-tab-blank')?.style.display !== 'none';
    const activeGrid = isBlank ? 'qr-grid-blank' : 'qr-grid-linked';
    const container = document.getElementById(activeGrid);

    if (!container || container.children.length === 0) {
      UI.toast('Aucun QR code à télécharger', 'warning');
      if (btn) { btn.disabled = false; btn.innerHTML = '📥 Télécharger ZIP'; }
      return;
    }

    // Charge JSZip dynamiquement
    if (!window.JSZip) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const zip = new JSZip();
    const items = container.querySelectorAll('.qr-item');

    items.forEach((item, i) => {
      // QRCode.js génère soit un canvas soit une img
      const canvas = item.querySelector('canvas');
      const img = item.querySelector('img');
      const label = item.querySelector('.qr-code-label');
      // Récupère le code depuis le texte monospace du label
      const codeEl = label?.querySelector('.font-mono');
      const code = codeEl?.textContent?.trim() || `qrcode-${i+1}`;
      const safeName = code.replace(/[^a-zA-Z0-9\-_]/g, '_');

      let dataUrl = null;
      if (canvas) {
        dataUrl = canvas.toDataURL('image/png');
      } else if (img) {
        // Redessine l'img dans un canvas pour obtenir le PNG
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        dataUrl = c.toDataURL('image/png');
      }

      if (dataUrl) {
        const base64 = dataUrl.split(',')[1];
        zip.file(`${safeName}.png`, base64, { base64: true });
      }
    });

    // Génère et télécharge le ZIP
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcodes-inventaire-${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    UI.toast(`${items.length} QR code(s) téléchargé(s)`, 'success');
    if (btn) { btn.disabled = false; btn.innerHTML = '📥 Télécharger ZIP'; }
  },

  _renderQRGrid(container, items, size, labelPos) {
    // Approche simple et fiable :
    // - "en dessous" : grille de colonnes fixes, items en colonne
    // - "à droite"   : liste verticale, chaque item est une ligne flex
    if (labelPos === 'right') {
      // Liste verticale : 1 item par ligne, QR à gauche + texte à droite
      container.style.cssText = `display:flex;flex-direction:column;gap:8px`;
    } else {
      container.style.cssText = `display:grid;grid-template-columns:repeat(auto-fill,${size+16}px);gap:10px`;
    }

    items.forEach(({code, label1, label2, label3}) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'qr-item';
      if (labelPos === 'right') {
        wrapper.style.cssText = `flex-direction:row;align-items:center;gap:12px;width:100%;padding:6px 10px`;
      } else {
        wrapper.style.cssText = `flex-direction:column;align-items:center;gap:4px;width:${size+16}px`;
      }

      const qrDiv = document.createElement('div');
      qrDiv.style.flexShrink = '0';

      const label = document.createElement('div');
      label.className = 'qr-code-label';
      if (labelPos === 'right') {
        label.style.cssText = `text-align:left;flex:1;min-width:0;word-break:break-word`;
      } else {
        label.style.cssText = `text-align:center;max-width:${size+20}px;word-break:break-word`;
      }
      label.innerHTML = [
        label1?`<div style="font-weight:700;font-size:11px;margin-bottom:2px">${Utils.escapeHtml(label1)}</div>`:'',
        label2?`<div style="font-size:10px;color:var(--c-text-secondary);margin-bottom:2px">${Utils.escapeHtml(label2)}</div>`:'',
        label3?`<div style="font-size:10px;color:var(--c-text-muted);margin-bottom:3px">📍 ${Utils.escapeHtml(label3)}</div>`:'',
        `<div class="font-mono" style="font-size:9px;color:var(--c-text-muted);letter-spacing:0.02em">${Utils.escapeHtml(code)}</div>`
      ].join('');

      wrapper.appendChild(qrDiv);
      wrapper.appendChild(label);
      container.appendChild(wrapper);

      new QRCode(qrDiv, {
        text: code, width: size, height: size,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    });
  },

  // ============================================================
  // UTILISATEURS
  // ============================================================
  async renderUsers() {
    const content = Pages.getMainContent();
    content.innerHTML = `
      <div class="page-header">
        <button class="sidebar-toggle" id="sidebar-toggle"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg></button>
        <h1 class="page-header-title">Gestion des comptes</h1>
        <button class="btn btn-primary btn-sm" id="add-user-btn">+ Créer un compte</button>
      </div>
      <div class="page-body">
        <div id="users-table"><div style="text-align:center;padding:30px"><div class="spinner"></div></div></div>
      </div>`;
    await Pages._loadUsers();
    document.getElementById('add-user-btn')?.addEventListener('click', () => {
      ['new-user-email','new-user-name','new-user-pass'].forEach(id => document.getElementById(id).value='');
      document.getElementById('new-user-role').value='user';
      UI.modal.open('add-user-modal');
      setTimeout(() => {
        const emailEl = document.getElementById('new-user-email');
        emailEl.focus();
        initDomainAutofill(emailEl);
      }, 150);
    });
  },

  async _loadUsers() {
    const { data, error } = await Users.getAll();
    const el = document.getElementById('users-table');
    if (!el) return;
    if (error||!data) { el.innerHTML='<div class="alert alert-danger">Erreur</div>'; return; }
    el.innerHTML = `<div class="table-wrapper"><table>
      <thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr></thead>
      <tbody>${data.map(user=>`<tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--c-accent-light);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:var(--c-accent);flex-shrink:0">${user.full_name.charAt(0).toUpperCase()}</div>
            <div>
              <div style="font-weight:500">${Utils.escapeHtml(user.full_name)}</div>
            </div>
          </div>
        </td>
        <td class="text-sm text-muted font-mono">${Utils.escapeHtml(user.username)}</td>
        <td><span class="badge ${user.role==='admin'?'badge-info':'badge-available'}">${user.role==='admin'?'⚙️ Admin':'👤 User'}</span></td>
        <td><span class="badge ${user.is_active?'badge-available':'badge-loaned'}">${user.is_active?'Actif':'Désactivé'}</span></td>
        <td class="text-sm" style="white-space:nowrap">${Utils.formatDate(user.created_at)}</td>
        <td>${user.id!==Auth.currentUser.id?`<div class="btn-group">
          <button class="btn btn-ghost btn-sm" onclick="Pages._toggleUser('${user.id}',${!user.is_active})">${user.is_active?'🔒':'🔓'}</button>
          <button class="btn btn-ghost btn-sm" onclick="Pages._changeRole('${user.id}','${user.role==='admin'?'user':'admin'}')">${user.role==='admin'?'⬇ User':'⬆ Admin'}</button>
        </div>`:'<span class="text-xs text-muted">(Vous)</span>'}</td>
      </tr>`).join('')}</tbody></table></div>`;
  },

  async _toggleUser(userId, activate) {
    const { error } = await Users.toggle(userId, activate);
    if (error) UI.toast('Erreur','error'); else { UI.toast(activate?'Compte activé':'Compte désactivé','success'); Pages._loadUsers(); }
  },

  async _changeRole(userId, newRole) {
    if (!await UI.confirm(`Changer vers "${newRole==='admin'?'Admin':'Utilisateur'}" ?`)) return;
    const { error } = await Users.setRole(userId, newRole);
    if (error) UI.toast('Erreur','error'); else { UI.toast('Rôle modifié','success'); Pages._loadUsers(); }
  },


  // ============================================================
  // PARAMÈTRES - Types de matériel
  // ============================================================
  async renderSettings() {
    const content = Pages.getMainContent();
    content.innerHTML = `
      <div class="page-header">
        <button class="sidebar-toggle" id="sidebar-toggle"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg></button>
        <h1 class="page-header-title">Paramètres</h1>
      </div>
      <div class="page-body">

        <!-- CHANGEMENT DE MOT DE PASSE -->
        <div class="card" style="margin-bottom:20px">
          <div class="card-header"><span class="card-title">🔑 Changer mon mot de passe</span></div>
          <div class="card-body">
            <div id="pw-success" class="alert alert-success hidden">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              Mot de passe modifié avec succès !
            </div>
            <div id="pw-error" class="alert alert-danger hidden">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span id="pw-error-msg"></span>
            </div>
            <div class="form-group">
              <label class="form-label">Mot de passe actuel <span class="required">*</span></label>
              <input type="password" id="pw-current" class="form-control" placeholder="Votre mot de passe actuel" minlength="6"/>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nouveau mot de passe <span class="required">*</span></label>
                <input type="password" id="pw-new" class="form-control" placeholder="Minimum 6 caractères" minlength="6"/>
              </div>
              <div class="form-group">
                <label class="form-label">Confirmer le nouveau mot de passe <span class="required">*</span></label>
                <input type="password" id="pw-confirm" class="form-control" placeholder="••••••••" minlength="6"/>
              </div>
            </div>
            <button class="btn btn-primary" id="pw-submit">💾 Modifier mon mot de passe</button>
          </div>
        </div>

        <!-- TYPES DE MATÉRIEL -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">📋 Types de matériel</span>
            <button class="btn btn-primary btn-sm" id="add-type-btn">+ Ajouter</button>
          </div>
          <div class="card-body">
            <p class="text-sm text-muted" style="margin-bottom:16px">Ces types apparaissent dans le sélecteur lors de l'enregistrement d'un équipement.</p>
            <div id="types-list"><div style="text-align:center;padding:20px"><div class="spinner"></div></div></div>
          </div>
        </div>
      </div>`;

    // Handler changement de mot de passe
    document.getElementById('pw-submit')?.addEventListener('click', async () => {
      const btn = document.getElementById('pw-submit');
      const currentPass = document.getElementById('pw-current').value;
      const newPass = document.getElementById('pw-new').value;
      const confirm = document.getElementById('pw-confirm').value;
      const errorEl = document.getElementById('pw-error');
      const errorMsg = document.getElementById('pw-error-msg');
      const successEl = document.getElementById('pw-success');

      errorEl.classList.add('hidden');
      successEl.classList.add('hidden');

      if (!currentPass) {
        errorMsg.textContent = 'Saisissez votre mot de passe actuel';
        errorEl.classList.remove('hidden'); return;
      }
      if (newPass.length < 6) {
        errorMsg.textContent = 'Le nouveau mot de passe doit faire au moins 6 caractères';
        errorEl.classList.remove('hidden'); return;
      }
      if (newPass !== confirm) {
        errorMsg.textContent = 'Les deux mots de passe ne correspondent pas';
        errorEl.classList.remove('hidden'); return;
      }
      if (currentPass === newPass) {
        errorMsg.textContent = 'Le nouveau mot de passe doit être différent du mot de passe actuel';
        errorEl.classList.remove('hidden'); return;
      }

      UI.setLoading(btn, true);

      // Vérifie l'ancien mot de passe en tentant une connexion silencieuse
      const { error: checkError } = await dbSignup.auth.signInWithPassword({
        email: Auth.currentUser.email,
        password: currentPass
      });
      if (checkError) {
        errorMsg.textContent = 'Mot de passe actuel incorrect';
        errorEl.classList.remove('hidden');
        UI.setLoading(btn, false);
        return;
      }

      const { error } = await db.auth.updateUser({ password: newPass });
      UI.setLoading(btn, false);

      if (error) {
        errorMsg.textContent = error.message;
        errorEl.classList.remove('hidden');
      } else {
        successEl.classList.remove('hidden');
        document.getElementById('pw-current').value = '';
        document.getElementById('pw-new').value = '';
        document.getElementById('pw-confirm').value = '';
        await Logs.write('PASSWORD_CHANGE', 'user', Auth.currentUser.id, {});
      }
    });

    await Pages._loadTypes();
    document.getElementById('add-type-btn')?.addEventListener('click', () => {
      document.getElementById('new-type-name').value='';
      UI.modal.open('add-type-modal');
      setTimeout(()=>document.getElementById('new-type-name').focus(),200);
    });
  },

  // Ouvre le picker  // Ouvre le picker de types sur le formulaire d'enregistrement
  async _loadTypes() {
    const types = await ItemTypes.getAll();
    const el = document.getElementById('types-list');
    if (!el) return;
    if (!types.length) {
      el.innerHTML = '<div class="empty-state"><p class="empty-state-text">Aucun type défini</p></div>';
      return;
    }
    el.innerHTML = `<div class="table-wrapper"><table>
      <thead><tr><th>Type de matériel</th><th>Actions</th></tr></thead>
      <tbody>${types.map(t => `<tr>
        <td style="font-weight:500">${Utils.escapeHtml(t.name)}</td>
        <td><button class="btn btn-ghost btn-sm" style="color:var(--c-danger)" onclick="Pages._deleteType('${t.id}','${Utils.escapeHtml(t.name)}')">🗑 Supprimer</button></td>
      </tr>`).join('')}</tbody></table></div>`;
  },

  async _deleteType(id, name) {
    if (!await UI.confirm(`Supprimer le type "${name}" ?`)) return;
    const { error } = await ItemTypes.delete(id);
    if (error) UI.toast('Erreur', 'error');
    else { UI.toast('Type supprimé', 'success'); Pages._loadTypes(); }
  },

  async openTypePicker(targetId) {
    const types = await ItemTypes.getAll();
    const list = document.getElementById('type-picker-list');
    list.innerHTML = types.map(t=>`
      <div class="type-picker-item" onclick="Pages._selectType('${targetId}','${Utils.escapeHtml(t.name)}')">
        ${Utils.escapeHtml(t.name)}
      </div>`).join('');
    UI.modal.open('type-picker-modal');
  },

  _selectType(targetId, name) {
    const el = document.getElementById(targetId);
    if (el) el.value = name;
    UI.modal.close('type-picker-modal');
  },

  // ============================================================
  // LOGS
  // ============================================================
  async renderLogs() {
    const content = Pages.getMainContent();
    content.innerHTML = `
      <div class="page-header">
        <button class="sidebar-toggle" id="sidebar-toggle"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg></button>
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


    const loadLogs = async () => {
      const search = document.getElementById('log-search')?.value.trim()||'';
      const action = document.getElementById('log-action')?.value||'';
      let query = db.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(200);
      if (action) query = query.eq('action',action);
      if (search) query = query.or(`username.ilike.%${search}%,action.ilike.%${search}%`);
      const { data, error } = await query;
      const el = document.getElementById('logs-table');
      if (!el) return;
      if (error) { el.innerHTML='<div class="alert alert-danger">Erreur</div>'; return; }
      if (!data?.length) { el.innerHTML='<div class="empty-state"><div class="empty-state-icon">📋</div><p class="empty-state-text">Aucun log</p></div>'; return; }
      const labels={LOGIN:'🔓 Connexion',LOGOUT:'🔒 Déconnexion',ITEM_CREATE:'📦 Création',ITEM_UPDATE:'✏️ Modification',ITEM_DELETE:'🗑️ Suppression',LOAN_CREATE:'🔄 Prêt',LOAN_RETURN:'✅ Restitution',USER_CREATE:'👤 Création compte',USER_ACTIVATE:'🔓 Activation',USER_DEACTIVATE:'🔒 Désactivation',USER_ROLE_CHANGE:'⚙️ Rôle'};
      el.innerHTML=`<div class="table-wrapper"><table>
        <thead><tr><th>Date/Heure</th><th>Utilisateur</th><th>Action</th><th>Détails</th></tr></thead>
        <tbody>${data.map(log=>{
          const details=log.details?Object.entries(log.details).filter(([k])=>!['password'].includes(k)).map(([k,v])=>`${k}: ${v}`).join(', '):'';
          return`<tr>
            <td class="text-xs font-mono" style="white-space:nowrap">${Utils.formatDateTime(log.created_at)}</td>
            <td style="font-weight:500">${Utils.escapeHtml(log.username||'—')}</td>
            <td class="text-sm">${labels[log.action]||'📝 '+log.action}</td>
            <td class="text-xs text-muted">${Utils.escapeHtml(details)}</td>
          </tr>`;
        }).join('')}</tbody></table></div>`;
    };

    await loadLogs();
    let t;
    document.getElementById('log-search')?.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(loadLogs,300);});
    document.getElementById('log-action')?.addEventListener('change',loadLogs);
  }
};

// ============================================================
// FORM HANDLERS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

  // REGISTER
  document.getElementById('register-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('register-submit');
    const qr = document.getElementById('register-qr').value.trim();
    const type = document.getElementById('register-type').value.trim();
    if (!qr||!type) { UI.toast('Code QR et type sont obligatoires','warning'); return; }
    UI.setLoading(btn,true);
    const { error } = await Items.create({
      qr_code:qr, type,
      brand:document.getElementById('register-brand').value.trim(),
      model:document.getElementById('register-model').value.trim(),
      description:document.getElementById('register-desc').value.trim(),
      storage_location:document.getElementById('register-location').value.trim()||null
    });
    UI.setLoading(btn,false);
    if (error) UI.toast(error.code==='23505'?'Ce code QR existe déjà':'Erreur : '+error.message,'error');
    else { UI.toast('Objet enregistré !','success'); UI.modal.close('register-modal'); if(App.currentPage==='inventory')Pages.renderInventory(); }
  });

  // LOAN - avec expected_return_date
  document.getElementById('loan-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('loan-submit');
    const itemId = document.getElementById('loan-item-id').value;
    const loanedTo = document.getElementById('loan-to').value.trim();
    const loanDate = document.getElementById('loan-date').value;
    if (!loanedTo||!loanDate) { UI.toast('Renseignez le destinataire et la date','warning'); return; }
    UI.setLoading(btn,true);
    const expectedReturn = document.getElementById('loan-expected-return').value;
    const { error } = await Loans.create({
      item_id:itemId, loaned_to:loanedTo, loan_date:loanDate,
      expected_return_date: expectedReturn||null,
      judicial_operation:document.getElementById('loan-operation').value.trim(),
      notes:document.getElementById('loan-notes').value.trim()
    });
    UI.setLoading(btn,false);
    if (error) UI.toast('Erreur : '+error.message,'error');
    else {
      UI.toast('Prêt enregistré !','success'); UI.modal.close('loan-modal');
      if(App.currentPage==='inventory')Pages.renderInventory();
      if(App.currentPage==='dashboard')Pages.renderDashboard();
    }
  });

  // RETURN
  document.getElementById('return-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('return-submit');
    UI.setLoading(btn,true);
    const { error } = await Loans.return(
      document.getElementById('return-loan-id').value,
      document.getElementById('return-item-id').value,
      { return_notes:document.getElementById('return-notes').value.trim() }
    );
    UI.setLoading(btn,false);
    if (error) UI.toast('Erreur : '+error.message,'error');
    else {
      UI.toast('Restitution enregistrée !','success'); UI.modal.close('return-modal');
      if(App.currentPage==='inventory')Pages.renderInventory();
      if(App.currentPage==='dashboard')Pages.renderDashboard();
    }
  });

  // EDIT
  document.getElementById('edit-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('edit-submit');
    UI.setLoading(btn,true);
    const type = document.getElementById('edit-type').value.trim();
    if (!type) { UI.toast('Le type est obligatoire','warning'); UI.setLoading(btn,false); return; }
    const { error } = await Items.update(document.getElementById('edit-item-id').value,{
      type,
      brand:document.getElementById('edit-brand').value.trim(),
      model:document.getElementById('edit-model').value.trim(),
      description:document.getElementById('edit-desc').value.trim(),
      storage_location:document.getElementById('edit-location').value.trim()||null,
      status:document.getElementById('edit-status').value
    });
    UI.setLoading(btn,false);
    if (error) UI.toast('Erreur : '+error.message,'error');
    else { UI.toast('Objet modifié !','success'); UI.modal.close('edit-modal'); Pages.renderInventory(); }
  });

  // ADD USER
  document.getElementById('add-user-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('add-user-submit');
    const email=document.getElementById('new-user-email').value.trim();
    const name=document.getElementById('new-user-name').value.trim();
    const pass=document.getElementById('new-user-pass').value;
    const role=document.getElementById('new-user-role').value;
    if (!email||!name||!pass) { UI.toast('Tous les champs sont obligatoires','warning'); return; }
    if (pass.length<6) { UI.toast('Mot de passe trop court (min. 6 caractères)','warning'); return; }
    UI.setLoading(btn,true);
    try {
      await Users.create(email,pass,name,role);
      UI.toast('Compte créé !','success'); UI.modal.close('add-user-modal'); Pages._loadUsers();
    } catch(err) {
      const msg = err.message?.includes('autorisés') ? err.message : err.message?.includes('already') ? 'Cet email est déjà utilisé' : 'Erreur : ' + err.message;
      UI.toast(msg,'error');
    }
    UI.setLoading(btn,false);
  });

  // ADD TYPE
  document.getElementById('add-type-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('add-type-submit');
    const name = document.getElementById('new-type-name').value.trim();
    if (!name) { UI.toast('Saisissez un nom','warning'); return; }
    UI.setLoading(btn,true);
    const { error } = await ItemTypes.add(name);
    UI.setLoading(btn,false);
    if (error) UI.toast(error.code==='23505'?'Ce type existe déjà':'Erreur : '+error.message,'error');
    else { UI.toast('Type ajouté !','success'); UI.modal.close('add-type-modal'); Pages._loadTypes(); }
  });

  document.getElementById('new-type-name')?.addEventListener('keydown', e => {
    if(e.key==='Enter') document.getElementById('add-type-submit')?.click();
  });
});
