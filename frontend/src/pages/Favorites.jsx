/**
 * Favorites.jsx
 * Fermate e linee preferite (localStorage via Zustand).
 */

import { Link } from 'react-router-dom';
import useFavoritesStore from '../store/favoritesStore';
import StopCard from '../components/StopCard';
import { getRouteTypeInfo } from '../utils/formatters';

function EmptyFavorites() {
  return (
    <div className="empty-state" style={{ marginTop: 'var(--space-xl)' }}>
      <div className="empty-state-icon">⭐</div>
      <p className="empty-state-title">Nessun preferito</p>
      <p className="empty-state-msg">
        Aggiungi fermate e linee ai preferiti per accedervi rapidamente.
        Apri una fermata e tocca "Aggiungi".
      </p>
      <Link to="/search" className="btn btn-primary btn-sm">
        Cerca fermate
      </Link>
    </div>
  );
}

function FavoriteLineItem({ route }) {
  const removeLine = useFavoritesStore(s => s.removeLine);
  const info = getRouteTypeInfo(route.routeType);
  const chipStyle = route.routeColor
    ? { backgroundColor: route.routeColor, color: '#fff' }
    : null;

  return (
    <div className="list-item">
      <span
        className={`route-chip ${chipStyle ? 'custom' : info.cssClass}`}
        style={chipStyle ?? undefined}
      >
        {route.routeShortName}
      </span>
      <Link to={`/lines/${route.routeId}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
        <div className="fw-600 truncate" style={{ fontSize: 15 }}>
          {route.routeLongName || route.routeShortName}
        </div>
        <div className="text-xs text-2">{info.label}</div>
      </Link>
      <button
        onClick={() => removeLine(route.routeId)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: 'var(--color-text-3)' }}
        aria-label="Rimuovi dai preferiti"
      >
        ✕
      </button>
    </div>
  );
}

export default function Favorites() {
  const stops = useFavoritesStore(s => s.stops);
  const lines = useFavoritesStore(s => s.lines);
  const removeStop = useFavoritesStore(s => s.removeStop);

  const stopList = Object.values(stops);
  const lineList = Object.values(lines);
  const isEmpty = stopList.length === 0 && lineList.length === 0;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Preferiti</div>
        <div className="page-subtitle">
          {stopList.length + lineList.length > 0
            ? `${stopList.length} fermate · ${lineList.length} linee`
            : 'Le tue fermate e linee salvate'}
        </div>
      </div>

      <div className="page-content">
        {isEmpty ? (
          <EmptyFavorites />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {/* Fermate preferite */}
            {stopList.length > 0 && (
              <div>
                <div className="section-label" style={{ paddingLeft: 0 }}>Fermate preferite</div>
                <div className="list-card">
                  {stopList.map(stop => (
                    <div key={stop.stopId} style={{ position: 'relative' }}>
                      <StopCard stop={stop} />
                      {/* Bottone rimozione sovrapposto */}
                      <button
                        onClick={() => removeStop(stop.stopId)}
                        style={{
                          position: 'absolute',
                          right: 36, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none',
                          cursor: 'pointer', padding: 8,
                          color: 'var(--color-text-3)', fontSize: 16,
                          zIndex: 1,
                        }}
                        aria-label="Rimuovi dai preferiti"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linee preferite */}
            {lineList.length > 0 && (
              <div>
                <div className="section-label" style={{ paddingLeft: 0 }}>Linee preferite</div>
                <div className="list-card">
                  {lineList.map(route => (
                    <FavoriteLineItem key={route.routeId} route={route} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
