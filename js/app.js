// ============================================================
// APP.JS - Application principale
// ============================================================

// ============================================================
// UI - Interface utilisateur
// ============================================================
const UI = {
  toast(message, type = 'default', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      default: 'ℹ'
    };

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
      if (el) {
        el.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    },
    close(id) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('open');
        document.body.style.overflow = '';
      }
    },
    closeAll() {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => {
        m.classList.remove('open');
      });
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

    // Affiche/cache les éléments admin
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
      document.getElementById('confirm-message').textContent = message;
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
// AUTOCOMPLETE WIDGET
// ============================================================
function initAutocomplete(inputEl, fetchFn) {
  let list = null;
  let highlighted = -1;

  inputEl.addEventListener('input', async () => {
    const val = inputEl.value.trim();
    const results = await fetchFn(val);
    renderList(results);
  });

  inputEl.addEventListener('focus', async () => {
    const results = await fetchFn(inputEl.value.trim());
    renderList(results);
  });

  inputEl.addEventListener('keydown', e => {
    const items = list?.querySelectorAll('.autocomplete-item') || [];
    if (e.key === 'ArrowDown') {
      highlighted = Math.min(highlighted + 1, items.length - 1);
      updateHighlight(items);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      highlighted = Math.max(highlighted - 1, -1);
      updateHighlight(items);
      e.preventDefault();
    } else if (e.key === 'Enter' && highlighted >= 0) {
      if (items[highlighted]) {
        inputEl.value = items[highlighted].textContent;
        closeList();
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      closeList();
    }
  });

  document.addEventListener('click', e => {
    if (!inputEl.contains(e.target) && !list?.contains(e.target)) {
      closeList();
    }
  });

  function renderList(results) {
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
  }

  function updateHighlight(items) {
    items.forEach((item, i) => {
      item.classList.toggle('highlighted', i === highlighted);
    });
  }

  function closeList() {
    list?.remove();
    list = null;
    highlighted = -1;
  }
}

// ============================================================
// QR SCANNER
// ============================================================
const Scanner = {
  stream: null,
  scanning: false,
  intervalId: null,
  onResult: null,

  async open(callback) {
    this.onResult = callback;
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
      video.play();
      this.scanning = true;
      this.startScanning();
    } catch (e) {
      console.error('Camera error:', e);
      UI.toast('Impossible d\'accéder à la caméra', 'error');
    }
  },

  startScanning() {
    const video = document.getElementById('qr-video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const scan = () => {
      if (!this.scanning || video.readyState !== video.HAVE_ENOUGH_DATA) {
        if (this.scanning) this.intervalId = requestAnimationFrame(scan);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code) {
          this.handleResult(code.data);
          return;
        }
      } catch (e) {}

      if (this.scanning) this.intervalId = requestAnimationFrame(scan);
    };

    this.intervalId = requestAnimationFrame(scan);
  },

  handleResult(code) {
    this.stop();
    UI.modal.close('scanner-modal');
    if (this.onResult) this.onResult(code.trim());
  },

  stop() {
    this.scanning = false;
    if (this.intervalId) cancelAnimationFrame(this.intervalId);
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    const video = document.getElementById('qr-video');
    if (video) { video.srcObject = null; }
  }
};

// ============================================================
// ROUTER - Navigation entre pages
// ============================================================
const App = {
  currentPage: null,

  pages: {
    login: Pages.renderLogin,
    dashboard: Pages.renderDashboard,
    inventory: Pages.renderInventory,
    qrcodes: Pages.renderQRCodes,
    users: Pages.renderUsers,
    logs: Pages.renderLogs
  },

  async init() {
    // Init auth
    const session = await Auth.init();

    if (session) {
      this.navigate('dashboard');
    } else {
      this.navigate('login');
    }

    // Event listeners globaux
    this.bindGlobalEvents();
  },

  navigate(page, params = {}) {
    if (!this.pages[page]) return;

    // Vérifications d'accès
    if (page !== 'login' && !Auth.isAuthenticated()) {
      this.navigate('login');
      return;
    }

    if ((page === 'users' || page === 'logs') && !Auth.isAdmin()) {
      UI.toast('Accès réservé à l\'administrateur', 'error');
      return;
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
    // Sidebar toggle mobile
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebar-overlay').classList.toggle('open');
    });

    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('open');
    });

    // Navigation sidebar
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        if (page) {
          this.navigate(page);
          // Ferme sidebar mobile
          document.getElementById('sidebar').classList.remove('open');
          document.getElementById('sidebar-overlay').classList.remove('open');
        }
      });
    });

    // Bouton scanner QR (FAB)
    document.getElementById('qr-fab')?.addEventListener('click', () => {
      this.openQRFlow();
    });

    // Fermeture modal scanner
    document.getElementById('scanner-close')?.addEventListener('click', () => {
      Scanner.stop();
      UI.modal.close('scanner-modal');
    });

    // Saisie manuelle du QR
    document.getElementById('manual-qr-btn')?.addEventListener('click', () => {
      const val = document.getElementById('manual-qr-input').value.trim();
      if (val) {
        Scanner.stop();
        UI.modal.close('scanner-modal');
        this.handleQRCode(val);
      } else {
        UI.toast('Saisissez un code', 'warning');
      }
    });

    document.getElementById('manual-qr-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        document.getElementById('manual-qr-btn').click();
      }
    });

    // Déconnexion
    document.getElementById('sidebar-user')?.addEventListener('click', async () => {
      const confirmed = await UI.confirm('Se déconnecter ?');
      if (confirmed) await Auth.logout();
    });

    // Fermeture modales sur backdrop
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) {
          if (backdrop.id === 'scanner-modal') Scanner.stop();
          UI.modal.close(backdrop.id);
        }
      });
    });
  },

  openQRFlow() {
    document.getElementById('manual-qr-input').value = '';
    Scanner.open(code => this.handleQRCode(code));
  },

  async handleQRCode(code) {
    // Affiche un loading
    UI.toast(`Recherche du code : ${code}`, 'default');

    const { data: item } = await Items.getByQR(code);

    if (!item) {
      // Objet inconnu → enregistrement
      Pages.renderRegisterItem(code);
    } else if (item.status === 'available') {
      // Objet libre → prêt
      Pages.renderLoanForm(item);
    } else {
      // Objet prêté → restitution
      const { data: loan } = await Loans.getActiveForItem(item.id);
      Pages.renderReturnForm(item, loan);
    }
  }
};

// Démarrage
document.addEventListener('DOMContentLoaded', () => App.init());
