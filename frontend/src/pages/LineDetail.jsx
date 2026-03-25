/**
 * LineDetail.jsx
 * Dettaglio linea: fermate, direzioni, capolinea.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getLine } from '../utils/api';
import useFavoritesStore from '../store/favoritesStore';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';

export default function LineDetail() {
  const { routeId } = useParams();
  const navigate = useNavigate();
  const isLineFavorite = useFavoritesStore(s => s.isLineFavorite);
  const addLine = useFavoritesStore(s => s.addLine);
  const removeLine = useFavoritesStore(s => s.removeLine);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['line', routeId],
    queryFn: () => getLine(routeId),
    staleTime: 10 * 60_000,
  });

  const route = data?.route;
  const isFav = isLineFavorite(routeId);

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-brand)' }}
          >
            <svg width="10" height="17" viewBox="0 0 10 17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M9 1L1 8.5 9 16"/>
            </svg>
          </button>

          <div style={{ flex: 1 }}>
            {isLoading ? (
              <div className="skeleton" style={{ height: 22, width: '60%' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {route && (
                  <span
                    className="route-chip custom"
                    style={{
                      backgroundColor: route.color || 'var(--color-brand)',
                      color: route.textColor || '#fff',
                      fontSize: 16, padding: '4px 12px',
                    }}
                  >
                    {route.route_short_name}
                  </span>
                )}
                <span className="page-title" style={{ fontSize: 18 }}>
                  {route?.route_long_name || 'Linea'}
                </span>
              </div>
            )}
            {route && <div className="page-subtitle">{route.typeLabel}</div>}
          </div>

          {/* Preferito */}
          {route && (
            <button
              onClick={() => isFav ? removeLine(routeId) : addLine(route)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 22, padding: 4,
              }}
              aria-label={isFav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
            >
              {isFav ? '⭐' : '☆'}
            </button>
          )}
        </div>
      </div>

      <div style={{ paddingTop: 'var(--space-sm)' }}>
        {isLoading && <LoadingSpinner />}
        {isError && <ErrorState onRetry={refetch} message="Impossibile caricare la linea" />}

        {data?.directions?.map(dir => (
          <div key={dir.direction_id} style={{ marginBottom: 'var(--space-md)' }}>
            {/* Header direzione */}
            <div className="section-label">
              Direzione {dir.headsign}
            </div>

            {/* Capolinea */}
            {dir.terminus && (
              <div className="card card-padded" style={{ margin: '0 var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div className="text-xs text-2">Da</div>
                    <div className="fw-600">{dir.terminus.first?.stop_name || '—'}</div>
                    <div className="text-xs text-3">{dir.terminus.first?.departure_time?.substring(0,5)}</div>
                  </div>
                  <div style={{ color: 'var(--color-text-3)', alignSelf: 'center', fontSize: 20 }}>→</div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="text-xs text-2">A</div>
                    <div className="fw-600">{dir.terminus.last?.stop_name || '—'}</div>
                    <div className="text-xs text-3">{dir.terminus.last?.arrival_time?.substring(0,5)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Lista fermate */}
            <div className="list-card" style={{ margin: '0 var(--space-md)' }}>
              {dir.stops.map((stop, i) => (
                <Link
                  key={stop.stop_id}
                  to={`/stops/${stop.stop_id}`}
                  className="list-item"
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: i === 0 || i === dir.stops.length - 1
                      ? (route?.color || 'var(--color-brand)')
                      : 'var(--color-bg-input)',
                    border: `2px solid ${route?.color || 'var(--color-brand)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    color: i === 0 || i === dir.stops.length - 1 ? 'white' : 'var(--color-text-2)',
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fw-600 truncate" style={{ fontSize: 15 }}>{stop.stop_name}</div>
                    {stop.stop_code && <div className="text-xs text-2">#{stop.stop_code}</div>}
                  </div>
                  <div className="text-xs text-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {stop.departure_time?.substring(0,5)}
                  </div>
                  <svg className="chevron" width="7" height="12" viewBox="0 0 7 12" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M1 1l5 5-5 5"/>
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
