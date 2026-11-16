import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import 'katex/dist/katex.min.css';
import './index.css';

// Limpiar cachés legadas que pudieran haber retenido HTML de desarrollo antiguo
if (typeof window !== 'undefined' && 'caches' in window) {
  caches
    .keys()
    .then((keys) => {
      keys.forEach((key) => {
        if (
          key === 'studyflow-app-shell-swr' ||
          key === 'studyflow-static-resources-swr'
        ) {
          caches.delete(key).catch(() => {});
        }
      });
    })
    .catch(() => {});
}

// Registro automático del Service Worker de Workbox con estrategia Stale-While-Revalidate
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      registration.update().catch(() => {});
      // Comprobar actualizaciones en segundo plano periódicamente cuando hay conexión
      window.setInterval(() => {
        if (navigator.onLine) {
          registration.update().catch(() => {});
        }
      }, 60 * 60 * 1000);
    }
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('studyflow:idb-swr-updated'));
  },
});

createRoot(document.getElementById('root')!).render(<App />);
