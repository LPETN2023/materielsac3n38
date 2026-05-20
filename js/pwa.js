if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Chemin relatif : fonctionne quel que soit le sous-dossier GitHub Pages
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW enregistré, scope:', reg.scope))
      .catch(err => console.log('SW erreur:', err));
  });
}

let deferredPrompt;

function showInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (banner) {
    banner.style.display = 'flex';
    document.body.classList.add('pwa-banner-visible');
  }
}

function hideInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (banner) {
    banner.style.display = 'none';
    document.body.classList.remove('pwa-banner-visible');
  }
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  hideInstallBanner();
});
