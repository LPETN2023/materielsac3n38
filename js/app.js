// ============================================================
// APP.JS
// ============================================================

const UI = {
  toast(message, type = 'default', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', warning: '⚠', default: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || icons.default}</span> ${Utils.escapeHtml(message)}`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.25s ease forwards';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  },

  modal: {
    open(id) {
      const el = document.getElementById(id);
      if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
    },
    close(id) {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
    },
    closeAll() {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
      document.body.style.overflow = '';
    }
  },

  updateUserDisplay(profile) {
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-avatar');
    if (nameEl) nameEl.textContent = profile.full_name;
    if (roleEl) roleEl.textContent = profile.role === 'admin' ? 'Administrateur' : 'Utilisateur';
    if (avatarEl) avatarEl.textContent = profile.full_name.charAt(0).toUpperCase();
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = profile.role === 'admin' ? '' : 'none';
    });
  },

  setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span>';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
      btn.disabled = false;
    }
  },

  confirm(message) {
    return new Promise(resolve => {
      const msgEl = document.getElementById('confirm-message');
      if (msgEl) msgEl.textContent = message;
      UI.modal.open('confirm-modal');
      const yesBtn = document.getElementById('confirm-yes');
      const noBtn = document.getElementById('confirm-no');
      const cleanup = () => {
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
        UI.modal.close('confirm-modal');
      };
      const onYes = () => { cleanup(); resolve(true); };
      const onNo = () => { cleanup(); resolve(false); };
      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
    });
  }
};

// ============================================================
// AUTOCOMPLETE
// ============================================================
function initAutocomplete(inputEl, fetchFn) {
  if (inputEl.dataset.ac) return;
  inputEl.dataset.ac = '1';
  let list = null, highlighted = -1;

  const show = async () => {
    const results = await fetchFn(inputEl.value.trim());
    closeList();
    if (!results.length) return;
    const wrapper = inputEl.closest('.autocomplete-wrapper') || inputEl.parentElement;
    list = document.createElement('div');
    list.className = 'autocomplete-list open';
    results.forEach(r => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = r;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        inputEl.value = r;
        closeList();
        inputEl.dispatchEvent(new Event('change'));
      });
      list.appendChild(item);
    });
    wrapper.appendChild(list);
    highlighted = -1;
  };

  inputEl.addEventListener('input', show);
  inputEl.addEventListener('focus', show);
  inputEl.addEventListener('keydown', e => {
    const items = list?.querySelectorAll('.autocomplete-item') || [];
    if (e.key === 'ArrowDown') { highlighted = Math.min(highlighted + 1, items.length - 1); updateHL(items); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { highlighted = Math.max(highlighted - 1, -1); updateHL(items); e.preventDefault(); }
    else if (e.key === 'Enter' && highlighted >= 0) { inputEl.value = items[highlighted].textContent; closeList(); e.preventDefault(); }
    else if (e.key === 'Escape') closeList();
  });
  document.addEventListener('click', e => {
    if (!inputEl.contains(e.target) && !list?.contains(e.target)) closeList();
  });

  function updateHL(items) { items.forEach((item, i) => item.classList.toggle('highlighted', i === highlighted)); }
  function closeList() { list?.remove(); list = null; highlighted = -1; }
}

// ============================================================
// DOMAIN AUTOFILL
// ============================================================
const DOMAIN = '@gendarmerie.interieur.gouv.fr';

function initDomainAutofill(inputEl) {
  if (!inputEl || inputEl.dataset.domainAc) return;
  inputEl.dataset.domainAc = '1';

  const applyDomain = () => {
    const val = inputEl.value.trim();
    if (val.length >= 3 && !val.includes('@')) {
      inputEl.value = val + DOMAIN;
    }
  };

  inputEl.addEventListener('blur', applyDomain);
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Tab' || e.key === 'Enter') applyDomain();
  });
}

// ============================================================
// QR SCANNER
// ============================================================
const Scanner = {
  stream: null, scanning: false, rafId: null, onResult: null,

  async open(callback) {
    this.onResult = callback;
    document.getElementById('manual-qr-input').value = '';
    UI.modal.open('scanner-modal');
    await this.startCamera();
  },

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      const video = document.getElementById('qr-video');
      video.srcObject = this.stream;
      await video.play();
      this.scanning = true;
      this.startScanning();
    } catch (e) {
      UI.toast('Impossible d\'accéder à la caméra. Utilisez la saisie manuelle.', 'warning');
    }
  },

  startScanning() {
    const video = document.getElementById('qr-video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scan = () => {
      if (!this.scanning) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
          if (code) { this.handleResult(code.data); return; }
        } catch (_) {}
      }
      this.rafId = requestAnimationFrame(scan);
    };
    this.rafId = requestAnimationFrame(scan);
  },

  handleResult(code) {
    this.stop();
    UI.modal.close('scanner-modal');
    if (this.onResult) this.onResult(code.trim());
  },

  stop() {
    this.scanning = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    const video = document.getElementById('qr-video');
    if (video) video.srcObject = null;
  }
};

// ============================================================
// ROUTER
// ============================================================
const App = {
  currentPage: null,

  pages: {
    login:     p => Pages.renderLogin(p),
    dashboard: p => Pages.renderDashboard(p),
    inventory: p => Pages.renderInventory(p),
    qrcodes:   p => Pages.renderQRCodes(p),
    settings:  p => Pages.renderSettings(p),
    users:     p => Pages.renderUsers(p),
    logs:      p => Pages.renderLogs(p)
  },

  async init() {
    const session = await Auth.init();
    if (session) {
      this.showApp();
      // Vérifie si l'utilisateur doit changer son mot de passe
      if (Auth.mustChangePassword()) {
        this.navigate('dashboard');
        setTimeout(() => Pages.showForcePasswordChange(), 300);
      } else {
        this.navigate('dashboard');
      }
    } else {
      this.navigate('login');
    }
    this.bindGlobalEvents();
  },

  showApp() {
    document.getElementById('main-content').style.marginLeft = '';
    document.getElementById('sidebar').style.display = '';
    document.getElementById('qr-fab').style.display = '';
  },

  navigate(page, params = {}) {
    if (!this.pages[page]) return;
    if (page !== 'login' && !Auth.isAuthenticated()) { this.navigate('login'); return; }
    if ((page === 'users' || page === 'logs') && !Auth.isAdmin()) {
      UI.toast('Accès réservé à l\'administrateur', 'error'); return;
    }
    // Bloque la navigation si changement de MDP obligatoire
    if (Auth.mustChangePassword() && page !== 'login') {
      if (page !== 'settings' && page !== 'dashboard') {
        Pages.showForcePasswordChange();
        return;
      }
    }
    this.currentPage = page;
    this.updateSidebarActive(page);
    this.pages[page](params);
  },

  updateSidebarActive(page) {
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
  },

  bindGlobalEvents() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    // Délégation d'événement pour sidebar-toggle (survit aux re-rendus)
    document.addEventListener('click', e => {
      if (e.target.closest('#sidebar-toggle')) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
      }
    });

    overlay?.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });

    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        if (page) {
          this.navigate(page);
          sidebar.classList.remove('open');
          overlay.classList.remove('open');
        }
      });
    });

    document.getElementById('qr-fab')?.addEventListener('click', () => this.openQRFlow());

    document.getElementById('scanner-close')?.addEventListener('click', () => {
      Scanner.stop();
      UI.modal.close('scanner-modal');
    });

    document.getElementById('manual-qr-btn')?.addEventListener('click', () => {
      const val = document.getElementById('manual-qr-input').value.trim();
      if (val) { Scanner.stop(); UI.modal.close('scanner-modal'); this.handleQRCode(val); }
      else UI.toast('Saisissez un code', 'warning');
    });
    document.getElementById('manual-qr-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('manual-qr-btn').click();
    });

    document.getElementById('sidebar-user')?.addEventListener('click', async () => {
      const confirmed = await UI.confirm('Se déconnecter ?');
      if (confirmed) await Auth.logout();
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) {
          if (backdrop.id === 'scanner-modal') Scanner.stop();
          // Ne ferme pas le modal de changement de MDP obligatoire
          if (backdrop.id !== 'force-password-modal') UI.modal.close(backdrop.id);
        }
      });
    });

    // Handler changement de mot de passe (propre)
    document.getElementById('change-password-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('change-password-submit');
      const oldPass = document.getElementById('cp-old').value;
      const newPass = document.getElementById('cp-new').value;
      const confirm = document.getElementById('cp-confirm').value;
      if (newPass !== confirm) { UI.toast('Les nouveaux mots de passe ne correspondent pas', 'warning'); return; }
      if (newPass.length < 8) { UI.toast('Le mot de passe doit faire au moins 8 caractères', 'warning'); return; }
      UI.setLoading(btn, true);
      try {
        await Auth.changePassword(oldPass, newPass);
        UI.toast('Mot de passe modifié avec succès !', 'success');
        UI.modal.close('change-password-modal');
        document.getElementById('change-password-form').reset();
      } catch (err) {
        UI.toast(err.message, 'error');
      }
      UI.setLoading(btn, false);
    });

    // Handler changement de MDP obligatoire
    document.getElementById('force-password-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('force-password-submit');
      const oldPass = document.getElementById('fp-old').value;
      const newPass = document.getElementById('fp-new').value;
      const confirm = document.getElementById('fp-confirm').value;
      if (newPass !== confirm) { UI.toast('Les mots de passe ne correspondent pas', 'warning'); return; }
      if (newPass.length < 8) { UI.toast('Minimum 8 caractères', 'warning'); return; }
      UI.setLoading(btn, true);
      try {
        await Auth.changePassword(oldPass, newPass);
        UI.toast('Mot de passe défini avec succès !', 'success');
        UI.modal.close('force-password-modal');
        document.body.style.overflow = '';
      } catch (err) {
        UI.toast(err.message, 'error');
        UI.setLoading(btn, false);
      }
    });
  },

  openQRFlow() {
    if (Auth.mustChangePassword()) { Pages.showForcePasswordChange(); return; }
    Scanner.open(code => this.handleQRCode(code));
  },

  async handleQRCode(code) {
    UI.toast(`Recherche : ${code}`, 'default', 1500);
    const { data: item } = await Items.getByQR(code);
    if (!item) {
      Pages.renderRegisterItem(code);
    } else if (item.status === 'available') {
      Pages.renderLoanForm(item);
    } else {
      const { data: loan } = await Loans.getActiveForItem(item.id);
      Pages.renderReturnForm(item, loan);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Détecte un lien de reset Supabase AVANT init()
  // Supabase met le token dans le hash : #access_token=...&type=recovery
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.replace('#', ''));
  const type = params.get('type');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (type === 'recovery' && accessToken) {
    // Nettoie l'URL immédiatement
    history.replaceState(null, '', window.location.pathname);

    // Établit la session manuellement avec le token
    db.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || '' })
      .then(() => {
        // Affiche directement le formulaire de reset
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('qr-fab').style.display = 'none';
        Pages.renderPasswordRecovery();
      })
      .catch(() => {
        App.init();
      });
    return;
  }

  App.init();
});
