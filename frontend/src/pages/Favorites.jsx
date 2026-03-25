/**
 * Favorites.jsx
 * Fermate, linee e percorsi frequenti salvati (localStorage via Zustand).
 */

import { Link, useNavigate } from 'react-router-dom';
import useFavoritesStore from '../store/favoritesStore';
import StopCard from '../components/StopCard';
import { getRouteTypeInfo } from '../utils/formatters';

// ─── Stato vuoto ─────────────────────────────────────────────────────────────

function EmptyFavorites() {
  return (
    <div className="empty-state" style={{ marginTop: 'var(--space-xl)' }}>
      <div className="empty-state-icon">⭐</div>
      <p className="empty-state-title">Nessun preferito</p>
      <p className="empty-state-msg">
        Aggiungi fermate e linee ai preferiti per accedervi rapidamente.
        I percorsi che usi spesso appariranno qui automaticamente.
      </p>
      <Link to="/search" className="btn btn-primary btn-sm">
        Cerca fermate
      </Link>
    </div>
  );
}

// ─── Item linea preferita ────────────────────────────────────────────────────

function FavoriteLineItem({ route }) {
  const removeLine = useFavoritesStore(s => s.removeLine);
  const info = getRouteTypeInfo(route.routeType);
  const chipStyle = route.routeColor
    ? { backgroundColor: route.routeColor, color: '#fff' }
    : null;

  return (
    <div className="list-item" style={{ gap: 'var(--space-md)' }}>
      <span
        className={`route-chip ${chipStyle ? 'custom' : info.cssClass}`}
        style={chipStyle ?? undefined}
        aria-hidden="true"
      >
        {route.routeShortName}
      </span>
      <Link
        to={`/lines/${route.routeId}`}
        style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
        aria-label={`Linea ${route.routeShortName} ${route.routeLongName || ''}`}
      >
        <div className="fw-600 truncate" style={{ fontSize: 15 }}>
          {route.routeLongName || route.routeShortName}
        </div>
        <div className="text-xs text-2">{info.label}</div>
      </Link>
      <button
        onClick={() => removeLine(route.routeId)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 10, color: 'var(--color-text-3)', minWidth: 44, minHeight: 44 }}
        aria-label={`Rimuovi linea ${route.routeShortName} dai preferiti`}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Item percorso frequente ─────────────────────────────────────────────────

function FrequentRouteItem({ route }) {
  const removeFrequentRoute = useFavoritesStore(s => s.removeFrequentRoute);
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/journey', {
      state: {
        fromStop: route.fromStop,
        toStop:   route.toStop,
      },
    });
  };

  return (
    <div className="list-item" style={{ gap: 'var(--space-md)' }}>
      <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden="true">🔄</span>
      <button
        onClick={handleClick}
        style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
        aria-label={`Percorso da ${route.fromStop.stopName} a ${route.toStop.stopName}`}
      >
        <div className="fw-600 truncate" style={{ fontSize: 15 }}>
          {route.fromStop.stopName}
        </div>
        <div className="text-xs text-2 truncate">→ {route.toStop.stopName}</div>
        {route.usageCount > 1 && (
          <div className="text-xs text-3">Usato {route.usageCount} volte</div>
        )}
      </button>
      <button
        onClick={() => removeFrequentRoute(route.key)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 10, color: 'var(--color-text-3)', minWidth: 44, minHeight: 44 }}
        aria-label={`Rimuovi percorso da ${route.fromStop.stopName} a ${route.toStop.stopName}`}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Pagina preferiti ────────────────────────────────────────────────────────

export default function Favorites() {
  const stops             = useFavoritesStore(s => s.stops);
  const lines             = useFavoritesStore(s => s.lines);
  const frequentRoutes    = useFavoritesStore(s => s.frequentRoutes);
  const removeStop        = useFavoritesStore(s => s.removeStop);
  const getTopFrequentRoutes = useFavoritesStore(s => s.getTopFrequentRoutes);

  const stopList    = Object.values(stops);
  const lineList    = Object.values(lines);
  const routeList   = getTopFrequentRoutes();

  const isEmpty = stopList.length === 0 && lineList.length === 0 && routeList.length === 0;

  const totalCount = stopList.length + lineList.length + routeList.length;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Preferiti</div>
        <div className="page-subtitle">
          {totalCount > 0
            ? [
                stopList.length  > 0 && `${stopList.length} ferm.`,
                lineList.length  > 0 && `${lineList.length} linee`,
                routeList.length > 0 && `${routeList.length} percorsi`,
              ].filter(Boolean).join(' · ')
            : 'Le tue fermate, linee e percorsi salvati'}
        </div>
      </div>

      <div className="page-content">
        {isEmpty ? (
          <EmptyFavorites />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

            {/* Percorsi frequenti */}
            {routeList.length > 0 && (
              <section aria-label="Percorsi frequenti">
                <div className="section-label" style={{ paddingLeft: 0 }}>Percorsi frequenti</div>
                <div className="list-card">
                  {routeList.map(r => (
                    <FrequentRouteItem key={r.key} route={r} />
                  ))}
                </div>
              </section>
            )}

            {/* Fermate preferite */}
            {stopList.length > 0 && (
              <section aria-label="Fermate preferite">
                <div className="section-label" style={{ paddingLeft: 0 }}>Fermate preferite</div>
                <div className="list-card">
                  {stopList.map(stop => (
                    <div key={stop.stopId} style={{ position: 'relative' }}>
                      <StopCard stop={stop} />
                      <button
                        onClick={() => removeStop(stop.stopId)}
                        style={{
                          position: 'absolute',
                          right: 36, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none',
                          cursor: 'pointer', padding: 10,
                          color: 'var(--color-text-3)', fontSize: 16,
                          zIndex: 1, minWidth: 44, minHeight: 44,
                        }}
                        aria-label={`Rimuovi fermata ${stop.stopName} dai preferiti`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Linee preferite */}
            {lineList.length > 0 && (
              <section aria-label="Linee preferite">
                <div className="section-label" style={{ paddingLeft: 0 }}>Linee preferite</div>
                <div className="list-card">
                  {lineList.map(route => (
                    <FavoriteLineItem key={route.routeId} route={route} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
