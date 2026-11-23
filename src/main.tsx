import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Tier 1 Demo Key Quota Defense: capture Google Maps auth & quota console errors
if (typeof window !== 'undefined') {
  (window as any).gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  };

  const origConsoleError = console.error;
  console.error = (...args: any[]) => {
    const joined = args.map((a) => (a && (a.message || a.stack)) || String(a)).join(' ');
    if (
      joined.includes('OverQuotaMapError') ||
      joined.includes('QuotaExceededError') ||
      joined.includes('OVER_QUERY_LIMIT')
    ) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
    origConsoleError.apply(console, args);
  };
}

// Register PWA service worker with auto-refresh support
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New update available');
  },
  onOfflineReady() {
    console.log('[PWA] Application ready for offline trade exploration');
  },
});

createRoot(document.getElementById('root')!).render(<App />);
