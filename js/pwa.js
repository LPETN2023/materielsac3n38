// ============================================================
// ENREGISTREMENT DU SERVICE WORKER (PWA)
// Ajouter ce script avant la fermeture de </body> dans index.html
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW enregistré:', reg.scope))
      .catch(err => console.log('SW erreur:', err));
  });
}

// Prompt d'installation PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;

  // Affiche une bannière d'installation (optionnel)
  const banner = document.getElementById('install-banner');
  if (banner) banner.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const banner = document.getElementById('install-banner');
  if (banner) banner.style.display = 'none';
});
