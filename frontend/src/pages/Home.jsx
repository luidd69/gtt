/**
 * Home.jsx
 * Schermata principale — accesso rapido a tutte le funzioni.
 */

import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getServiceStatus, getGtfsInfo } from '../utils/api';
import useFavoritesStore from '../store/favoritesStore';
import useThemeStore from '../store/themeStore';
import StopCard from '../components/StopCard';

const QUICK_ACTIONS = [
  { to: '/journey',   icon: '🗺️', label: 'Cerca tragitto' },
  { to: '/search',    icon: '🔍', label: 'Cerca fermata' },
  { to: '/nearby',    icon: '📍', label: 'Fermate vicine' },
  { to: '/metro',     icon: '🚇', label: 'Metro' },
  { to: '/map',       icon: '📡', label: 'Mappa veicoli' },
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

function FrequentRoutes() {
  const getTopFrequentRoutes = useFavoritesStore(s => s.getTopFrequentRoutes);
  const navigate = useNavigate();
  const routes = getTopFrequentRoutes().slice(0, 3);

  if (!routes.length) return null;

  return (
    <section>
      <div className="section-label">Percorsi frequenti</div>
      <div style={{ padding: '0 var(--space-md)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {routes.map(r => (
          <button
            key={r.key}
            onClick={() => navigate('/journey', { state: { fromStop: r.fromStop, toStop: r.toStop } })}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer', textAlign: 'left',
              boxShadow: 'var(--shadow-card)',
            }}
            aria-label={`Pianifica percorso da ${r.fromStop.stopName} a ${r.toStop.stopName}`}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }} aria-hidden="true">🔄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="fw-600 truncate" style={{ fontSize: 14 }}>
                {r.fromStop.stopName}
              </div>
              <div className="text-xs text-2 truncate">→ {r.toStop.stopName}</div>
            </div>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
              stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round"
              aria-hidden="true">
              <path d="M1 1l5 5-5 5"/>
            </svg>
          </button>
        ))}
      </div>
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
  const navigate = useNavigate();
  const setTheme = useThemeStore(s => s.setTheme);

  function goToV2() {
    setTheme('v2');
    navigate('/v2');
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          <button
            onClick={goToV2}
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-pill)',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-brand)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            aria-label="Prova il nuovo design V2"
          >
            ✨ Nuovo design
          </button>
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

        {/* Percorsi frequenti */}
        <FrequentRoutes />

        {/* Fermate preferite */}
        <FavoriteStops />

        {/* Info dati */}
        <GtfsInfo />
      </div>
    </div>
  );
}
