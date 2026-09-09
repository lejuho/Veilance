import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { loadApi } from './api/client';
import { App } from './App';
import { RoleProvider } from './state/role';
import './index.css';

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 500 } },
});

loadApi().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={qc}>
        <RoleProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RoleProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
