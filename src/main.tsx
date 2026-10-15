import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register PWA service worker with autoUpdate immediately for reliable mobile installation
try {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] Nueva versión disponible.');
    },
    onOfflineReady() {
      console.log('[PWA] Aplicación lista para trabajar sin conexión.');
    },
  });
} catch {
  // virtual:pwa-register fallback
}

// Direct registration of public/sw.js to guarantee standard PWA installation criteria
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[PWA] Service Worker activo:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Registro de SW:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

