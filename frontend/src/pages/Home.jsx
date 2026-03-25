/**
 * Home.jsx
 * Schermata principale — accesso rapido a tutte le funzioni.
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getServiceStatus, getGtfsInfo } from '../utils/api';
import useFavoritesStore from '../store/favoritesStore';
import StopCard from '../components/StopCard';

const QUICK_ACTIONS = [
  { to: '/search',    icon: '🔍', label: 'Cerca fermata' },
  { to: '/metro',     icon: '🚇', label: 'Metro' },
  { to: '/nearby',    icon: '📍', label: 'Fermate vicine' },
  { to: '/favorites', icon: '⭐', label: 'Preferiti' },
];

function ServiceBanner() {
  const { data } = useQuery({
    queryKey: ['service-status'],
    queryFn: getServiceStatus,
    staleTime: 60_000,
    retry: 1,
  });

  if (!data) return null;

  if (!data.realtimeEnabled) {
    return (
      <div className="notice notice-info" style={{ margin: '0 var(--space-md)' }}>
        <span>ℹ️</span>
        <span>Orari programmati ufficiali GTT. Aggiornamenti in tempo reale non disponibili.</span>
      </div>
    );
  }

  if (data.alerts?.length > 0) {
    const firstAlert = data.alerts[0];
    return (
      <div className="notice notice-warning" style={{ margin: '0 var(--space-md)' }}>
        <span>⚠️</span>
        <div>
          <div style={{ fontWeight: 600 }}>
            {firstAlert.header || 'Avvisi di servizio attivi'}
          </div>
          {data.alerts.length > 1 && (
            <div style={{ fontSize: 12, marginTop: 2 }}>
              +{data.alerts.length - 1} altri avvisi attivi
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="notice notice-info" style={{ margin: '0 var(--space-md)' }}>
      <span style={{ color: 'var(--color-success)' }}>●</span>
      <span>Servizio regolare · dati in tempo reale attivi</span>
    </div>
  );
}

function FavoriteStops() {
  const stops = useFavoritesStore(s => s.stops);
  const stopList = Object.values(stops).slice(0, 3);

  if (!stopList.length) return null;

  return (
    <section>
      <div className="section-label">Fermate preferite</div>
      <div className="list-card" style={{ margin: '0 var(--space-md)' }}>
        {stopList.map(s => (
          <StopCard key={s.stopId} stop={s} />
        ))}
      </div>
      {Object.values(stops).length > 3 && (
        <Link
          to="/favorites"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '10px',
            color: 'var(--color-brand)',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Vedi tutti i preferiti →
        </Link>
      )}
    </section>
  );
}

function GtfsInfo() {
  const { data } = useQuery({
    queryKey: ['gtfs-info'],
    queryFn: getGtfsInfo,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (!data?.loaded) return null;

  const date = data.loadedAt
    ? new Date(data.loadedAt).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long',
      })
    : '—';

  return (
    <div style={{ padding: '0 var(--space-md)', paddingBottom: 'var(--space-lg)' }}>
      <p style={{ fontSize: 11, color: 'var(--color-text-3)', textAlign: 'center' }}>
        Dati GTFS aggiornati al {date} · {data.stats.stops.toLocaleString('it-IT')} fermate ·{' '}
        {data.stats.routes.toLocaleString('it-IT')} linee
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'var(--color-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>
            🚌
          </div>
          <div>
            <div className="page-title" style={{ fontSize: 20 }}>GTT Torino</div>
            <div className="page-subtitle">Orari e arrivi</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingTop: 'var(--space-md)' }}>
        {/* Stato servizio */}
        <ServiceBanner />

        {/* Quick Actions */}
        <div style={{ padding: '0 var(--space-md)' }}>
          <div className="quick-grid">
            {QUICK_ACTIONS.map(a => (
              <Link key={a.to} to={a.to} className="quick-btn">
                <span className="quick-btn-icon">{a.icon}</span>
                <span className="quick-btn-label">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Preferiti */}
        <FavoriteStops />

        {/* Info dati */}
        <GtfsInfo />
      </div>
    </div>
  );
}
