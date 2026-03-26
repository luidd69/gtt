/**
 * HomeV2.jsx (V2)
 * Homepage ridisegnata: header compatto, azioni a griglia,
 * percorsi recenti orizzontali, banner stato servizio.
 */

import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getServiceStatus, getGtfsInfo } from '../../utils/api';
import useFavoritesStore from '../../store/favoritesStore';
import StopCardV2 from '../../components/v2/StopCardV2';

const QUICK_ACTIONS = [
  { to: '/v2/journey', icon: '🗺️', label: 'Tragitto'       },
  { to: '/v2/search',  icon: '🔍', label: 'Fermate'         },
  { to: '/nearby',     icon: '📍', label: 'Vicine'           },
  { to: '/metro',      icon: '🚇', label: 'Metro'            },
  { to: '/map',        icon: '📡', label: 'Mappa live'       },
  { to: '/favorites',  icon: '⭐', label: 'Preferiti'        },
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
      <div className="v2-notice info" style={{ margin: '0 var(--v2-sp-md)' }}>
        <span>ℹ️</span>
        <span>Orari programmati. Aggiornamenti realtime non disponibili.</span>
      </div>
    );
  }

  if (data.alerts?.length > 0) {
    return (
      <div className="v2-notice warning" style={{ margin: '0 var(--v2-sp-md)' }}>
        <span>⚠️</span>
        <div>
          <div style={{ fontWeight: 700 }}>{data.alerts[0].header || 'Avvisi di servizio'}</div>
          {data.alerts.length > 1 && (
            <div style={{ fontSize: 12, marginTop: 2 }}>+{data.alerts.length - 1} altri avvisi</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="v2-notice success" style={{ margin: '0 var(--v2-sp-md)' }}>
      <span className="v2-rt-dot" />
      <span style={{ fontWeight: 600 }}>Servizio regolare · realtime attivo</span>
    </div>
  );
}

function FrequentRoutes() {
  const getTopFrequentRoutes = useFavoritesStore(s => s.getTopFrequentRoutes);
  const navigate = useNavigate();
  const routes = getTopFrequentRoutes().slice(0, 4);

  if (!routes.length) return null;

  return (
    <section>
      <div className="v2-section-label">Percorsi recenti</div>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{
          display: 'flex', gap: 10,
          padding: '0 var(--v2-sp-md)',
          width: 'max-content',
        }}>
          {routes.map(r => (
            <button
              key={r.key}
              onClick={() => navigate('/v2/journey', { state: { fromStop: r.fromStop, toStop: r.toStop } })}
              style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                padding: '12px 14px',
                background: 'var(--v2-surface-1)',
                border: '1px solid var(--v2-border)',
                borderRadius: 'var(--v2-r-md)',
                cursor: 'pointer', textAlign: 'left',
                boxShadow: 'var(--v2-shadow-sm)',
                minWidth: 160, maxWidth: 200,
                fontFamily: 'inherit',
              }}
              aria-label={`Percorso da ${r.fromStop.stopName} a ${r.toStop.stopName}`}
            >
              <div className="v2-fw-600 v2-truncate" style={{ fontSize: 13, color: 'var(--v2-text-1)' }}>
                {r.fromStop.stopName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--v2-text-3)' }}>↓</span>
                <div className="v2-truncate" style={{ fontSize: 12, color: 'var(--v2-text-2)' }}>
                  {r.toStop.stopName}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function FavoriteStops() {
  const stops = useFavoritesStore(s => s.stops);
  const stopList = Object.values(stops).slice(0, 3);
  if (!stopList.length) return null;

  return (
    <section>
      <div className="v2-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 'var(--v2-sp-md)' }}>
        <span>Fermate preferite</span>
        {Object.values(stops).length > 3 && (
          <Link to="/favorites" style={{ fontSize: 12, color: 'var(--v2-brand)', fontWeight: 600, textDecoration: 'none' }}>
            Vedi tutti
          </Link>
        )}
      </div>
      <div className="v2-list" style={{ margin: '0 var(--v2-sp-md)' }}>
        {stopList.map(s => (
          <StopCardV2 key={s.stopId} stop={s} />
        ))}
      </div>
    </section>
  );
}

function GtfsFooter() {
  const { data } = useQuery({
    queryKey: ['gtfs-info'],
    queryFn: getGtfsInfo,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (!data?.loaded) return null;

  const date = data.loadedAt
    ? new Date(data.loadedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'long' })
    : '—';

  return (
    <div style={{ padding: 'var(--v2-sp-md)', paddingBottom: 'var(--v2-sp-xl)', textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: 'var(--v2-text-3)', lineHeight: 1.5 }}>
        GTFS aggiornato al {date} · {data.stats?.stops?.toLocaleString('it-IT')} fermate ·{' '}
        {data.stats?.routes?.toLocaleString('it-IT')} linee
      </p>
    </div>
  );
}

export default function HomeV2() {
  return (
    <div className="v2-page">
      {/* Header */}
      <div className="v2-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36,
            borderRadius: 10,
            background: 'var(--v2-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
            boxShadow: '0 2px 8px rgba(232,67,43,.35)',
          }}>
            🚌
          </div>
          <div style={{ flex: 1 }}>
            <div className="v2-title" style={{ fontSize: 19 }}>GTT Torino</div>
            <div className="v2-subtitle">Orari e arrivi in tempo reale</div>
          </div>
          <button
            onClick={() => window.close()}
            title="Chiudi app"
            aria-label="Chiudi app"
            style={{
              background: 'var(--v2-surface-2)',
              border: '1px solid var(--v2-border)',
              borderRadius: 'var(--v2-r-sm)',
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              color: 'var(--v2-text-3)',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--v2-delayed-heavy-bg)'; e.currentTarget.style.color = 'var(--v2-delayed-heavy)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--v2-surface-2)'; e.currentTarget.style.color = 'var(--v2-text-3)'; }}
          >
            {/* Power/X icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-sp-md)', paddingTop: 'var(--v2-sp-md)' }}>
        {/* Stato servizio */}
        <ServiceBanner />

        {/* Quick Actions */}
        <section>
          <div className="v2-section-label">Funzioni</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            padding: '0 var(--v2-sp-md)',
          }}>
            {QUICK_ACTIONS.map(a => (
              <Link key={a.to} to={a.to} className="v2-tile" style={{ textDecoration: 'none' }}>
                <span className="v2-tile-icon">{a.icon}</span>
                <span className="v2-tile-label">{a.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Percorsi recenti */}
        <FrequentRoutes />

        {/* Fermate preferite */}
        <FavoriteStops />

        {/* Footer GTFS */}
        <GtfsFooter />
      </div>
    </div>
  );
}
