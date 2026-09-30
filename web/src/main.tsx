import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { loadApi } from './api/client';
import { App } from './App';
import { installDevWallet } from './lib/devWallet';
import { resolveV2Mode, STATIC_BUILD } from './v2/mode';
import { ModeGate } from './v2/ModeGate';
import './index.css';

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 500 } },
});

// Delegated wallet (agent/API.md v1.4 addendum): VITE_DEV_WALLET=1 installs
// a fake window.midnight.veilanceDev before anything looks for wallets, so
// the round trip is testable without a real Lace install — see docs/WALLET.md.
if (import.meta.env.VITE_DEV_WALLET === '1') installDevWallet();

Promise.all([loadApi(), resolveV2Mode()]).then(([, mode]) => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      {mode === 'unreachable' ? (
        <ModeGate />
      ) : (
        <QueryClientProvider client={qc}>
          {STATIC_BUILD ? (
            <HashRouter>
              <App />
            </HashRouter>
          ) : (
            <BrowserRouter>
              <App />
            </BrowserRouter>
          )}
        </QueryClientProvider>
      )}
    </React.StrictMode>,
  );
});
