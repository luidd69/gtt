/**
 * StopDetail.jsx
 * Scheda fermata: info + prossimi arrivi con auto-refresh.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStop } from '../utils/api';
import { useArrivals } from '../hooks/useArrivals';
import { formatStopName, extractStopCode } from '../utils/formatters';
import useFavoritesStore from '../store/favoritesStore';
import ArrivalItem from '../components/ArrivalItem';
import LoadingSpinner, { SkeletonList } from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';

function FavoriteButton({ stop }) {
  const isStopFavorite = useFavoritesStore(s => s.isStopFavorite);
  const addStop = useFavoritesStore(s => s.addStop);
  const removeStop = useFavoritesStore(s => s.removeStop);

  const stopId = stop?.stop_id || stop?.stopId;
  const isFav = isStopFavorite(stopId);

  if (!stop) return null;

  return (
    <button
      onClick={() => isFav ? removeStop(stopId) : addStop(stop)}
      style={{
        background: isFav ? 'var(--color-brand)' : 'var(--color-bg-input)',
        border: 'none',
        borderRadius: 'var(--radius-pill)',
        padding: '8px 16px',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        color: isFav ? 'white' : 'var(--color-text)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'background 0.2s',
      }}
      aria-label={isFav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
    >
      {isFav ? '⭐ Preferita' : '☆ Aggiungi'}
    </button>
  );
}

function ArrivalsSection({ stopId }) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    dataUpdatedAt,
  } = useArrivals(stopId, 30);

  if (isLoading) return <SkeletonList rows={5} />;
  if (isError) return <ErrorState onRetry={refetch} message="Impossibile caricare gli arrivi" />;

  const { arrivals = [], realtimeAvailable, realtimeNote, message } = data || {};

  const updatedTime = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div>
      {/* Stato realtime */}
      <div className="section-label">Prossimi passaggi</div>

      {realtimeNote && (
        <div className="notice notice-info" style={{ margin: '0 var(--space-md) var(--space-sm)' }}>
          <span>ℹ️</span>
          <span>{realtimeNote}</span>
        </div>
      )}

      {arrivals.length === 0 ? (
        <div className="card card-padded" style={{ margin: '0 var(--space-md)' }}>
          <div className="empty-state" style={{ padding: 'var(--space-lg) 0' }}>
            <div className="empty-state-icon">🕐</div>
            <p className="empty-state-title">Nessun passaggio</p>
            <p className="empty-state-msg">{message || 'Nessun passaggio previsto nei prossimi 90 minuti'}</p>
          </div>
        </div>
      ) : (
        <div className="list-card" style={{ margin: '0 var(--space-md)' }}>
          {arrivals.map((arrival, i) => (
            <ArrivalItem key={`${arrival.tripId}-${i}`} arrival={arrival} />
          ))}
        </div>
      )}

      {/* Timestamp aggiornamento */}
      <div className="rt-status-bar" style={{ margin: 'var(--space-sm) var(--space-md) 0' }}>
        {realtimeAvailable ? (
          <>
            <span className="realtime-dot" />
            <span>Dati in tempo reale</span>
          </>
        ) : (
          <span>📅 Orari programmati</span>
        )}
        {updatedTime && (
          <span style={{ marginLeft: 'auto' }}>Aggiornato {updatedTime}</span>
        )}
      </div>
    </div>
  );
}

export default function StopDetail() {
  const { stopId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['stop', stopId],
    queryFn: () => getStop(stopId),
    staleTime: 5 * 60_000,
  });

  const stop = data?.stop;
  const routes = data?.routes || [];

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-brand)' }}
            aria-label="Torna indietro"
          >
            <svg width="10" height="17" viewBox="0 0 10 17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M9 1L1 8.5 9 16"/>
            </svg>
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            {isLoading ? (
              <>
                <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 14, width: '40%' }} />
              </>
            ) : (
              <>
                <div className="page-title" style={{ fontSize: 18 }}>
                  {stop ? (formatStopName(stop.stop_name) || stop.stop_name) : 'Fermata'}
                </div>
                <div className="page-subtitle">
                  {stop && `#${stop.stop_code || extractStopCode(stop.stop_name)}`}
                  {routes.length > 0 && ` · ${routes.length} linee`}
                </div>
              </>
            )}
          </div>

          <FavoriteButton stop={stop} />
        </div>

        {/* Chips linee */}
        {routes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {routes.map(r => {
              const style = r.route_color
                ? { backgroundColor: `#${r.route_color}`, color: r.route_text_color ? `#${r.route_text_color}` : '#fff' }
                : null;
              return (
                <span key={r.route_id} className={`route-chip ${style ? 'custom' : ''}`} style={style ?? undefined}>
                  {r.route_short_name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {isError && <ErrorState onRetry={refetch} message="Impossibile caricare la fermata" />}

      {!isError && (
        <div style={{ paddingTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <ArrivalsSection stopId={stopId} />
        </div>
      )}
    </div>
  );
}
