import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// In development, unregister any active service worker to prevent reload loops in the iframe preview
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  } else {
    // In production, register PWA service worker with autoUpdate
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
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

