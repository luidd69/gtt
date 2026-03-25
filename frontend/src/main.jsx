import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import './styles/v2.css';

// React Query: configurazione globale
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // dati considerati freschi per 30s
      gcTime: 5 * 60 * 1000,   // mantieni in cache per 5 min
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Registra Service Worker (PWA)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service Worker non registrato:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
