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

// SVG icons per le quick actions
const IconRoute = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/>
    <path d="M6 17V9a3 3 0 0 1 3-3h6"/>
    <path d="M15 3l3 2-3 2"/>
  </svg>
);
const IconStop = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <path d="M3 9h18M9 21V9"/>
  </svg>
);
const IconNear = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/>
    <circle cx="12" cy="9" r="2.5"/>
  </svg>
);
const IconMetro = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="3"/>
    <path d="M8 5v14M16 5v14M3 12h18"/>
    <circle cx="7" cy="17" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="17" cy="17" r="1.2" fill="currentColor" stroke="none"/>
  </svg>
);
const IconMap = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
    <path d="M9 3v15M15 6v15"/>
  </svg>
);
const IconStar = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const QUICK_ACTIONS = [
  { to: '/v2/journey', Icon: IconRoute, label: 'Tragitto'  },
  { to: '/v2/search',  Icon: IconStop,  label: 'Fermate'   },
  { to: '/nearby',     Icon: IconNear,  label: 'Vicine'    },
  { to: '/metro',      Icon: IconMetro, label: 'Metro'     },
  { to: '/map',        Icon: IconMap,   label: 'Mappa live'},
  { to: '/favorites',  Icon: IconStar,  label: 'Preferiti' },
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
            <div className="v2-subtitle">
              {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
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
            {QUICK_ACTIONS.map((a, i) => (
              <Link
                key={a.to}
                to={a.to}
                className={`v2-tile v2-animate-in v2-animate-in-d${Math.min(i + 1, 6)}`}
                style={{ textDecoration: 'none' }}
              >
                <span className="v2-tile-icon"><a.Icon /></span>
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
