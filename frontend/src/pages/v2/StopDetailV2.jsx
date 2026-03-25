/**
 * StopDetailV2.jsx (V2)
 * Scheda fermata con design V2: arrivi con ArrivalRow, CTA tragitto.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStop } from '../../utils/api';
import { useArrivals } from '../../hooks/useArrivals';
import { formatStopName, extractStopCode } from '../../utils/formatters';
import useFavoritesStore from '../../store/favoritesStore';
import ArrivalRow from '../../components/v2/ArrivalRow';

function ArrivalsV2({ stopId }) {
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useArrivals(stopId, 30);

  const arrivals = data?.arrivals ?? [];
  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  if (isLoading) {
    return (
      <div className="v2-list">
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{
            height: 64, background: 'var(--v2-surface-2)',
            borderRadius: 'var(--v2-r-md)', marginBottom: 2,
            animation: 'v2-pulse 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--v2-text-3)', marginBottom: 12 }}>
          Impossibile caricare gli arrivi
        </div>
        <button
          onClick={refetch}
          className="v2-btn v2-btn-primary"
          style={{ fontSize: 13 }}
        >
          Riprova
        </button>
      </div>
    );
  }

  if (!arrivals.length) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--v2-text-3)' }}>
        Nessun arrivo nelle prossime ore
      </div>
    );
  }

  return (
    <div>
      {updatedAt && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 0 8px',
        }}>
          <span style={{ fontSize: 11, color: 'var(--v2-text-3)' }}>
            Aggiornato alle {updatedAt}
          </span>
          <span className="v2-rt-dot" />
        </div>
      )}
      <div className="v2-list">
        {arrivals.map((a, i) => <ArrivalRow key={i} arrival={a} />)}
      </div>
    </div>
  );
}

export default function StopDetailV2() {
  const { stopId } = useParams();
  const navigate = useNavigate();

  const isStopFavorite = useFavoritesStore(s => s.isStopFavorite);
  const addStop = useFavoritesStore(s => s.addStop);
  const removeStop = useFavoritesStore(s => s.removeStop);

  const { data: stopData, isLoading: stopLoading } = useQuery({
    queryKey: ['stop', stopId],
    queryFn: () => getStop(stopId),
    staleTime: 60_000,
    retry: 1,
  });

  const stop = stopData?.stop;
  const isFav = isStopFavorite(stopId);
  const stopCode = stop ? extractStopCode(stop) : null;
  const stopName = stop ? formatStopName(stop.stop_name) : `Fermata ${stopId}`;

  return (
    <div className="v2-page" style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div className="v2-header" style={{ paddingBottom: 'var(--v2-sp-md)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'var(--v2-surface-2)', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--v2-r-sm)', padding: 8, flexShrink: 0, marginTop: 2,
            }}
            aria-label="Indietro"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--v2-text-1)" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {stopLoading ? (
              <div style={{ height: 24, width: '60%', background: 'var(--v2-surface-2)', borderRadius: 4 }} />
            ) : (
              <>
                <div className="v2-title v2-truncate" style={{ fontSize: 18 }}>
                  {stopName}
                </div>
                {stopCode && (
                  <div className="v2-subtitle">
                    Codice {stopCode}
                    {stop?.stop_desc ? ` · ${stop.stop_desc}` : ''}
                  </div>
                )}
              </>
            )}
          </div>
          <button
            onClick={() => isFav ? removeStop(stopId) : addStop(stop || { stop_id: stopId, stop_name: stopName })}
            style={{
              background: isFav ? 'var(--v2-brand)' : 'var(--v2-surface-2)',
              border: 'none', borderRadius: 'var(--v2-r-pill)', cursor: 'pointer',
              padding: '7px 12px', fontSize: 12, fontWeight: 700,
              color: isFav ? '#fff' : 'var(--v2-text-2)',
              fontFamily: 'inherit', flexShrink: 0,
            }}
            aria-label={isFav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
          >
            {isFav ? '⭐' : '☆'}
          </button>
        </div>
      </div>

      {/* Arrivals */}
      <div style={{ padding: '0 var(--v2-sp-md)' }}>
        <div className="v2-section-label">Prossimi arrivi</div>
        <ArrivalsV2 stopId={stopId} />
      </div>

      {/* CTA: plan journey from here */}
      <div style={{
        position: 'fixed', bottom: 72, left: 0, right: 0,
        padding: '12px var(--v2-sp-md)',
        background: 'linear-gradient(to top, var(--v2-bg) 70%, transparent)',
      }}>
        <button
          className="v2-btn v2-btn-primary"
          style={{ width: '100%', fontSize: 15 }}
          onClick={() => navigate('/v2/journey', {
            state: { fromStop: { stopId, stopName } },
          })}
        >
          🗺️ Cerca tragitto da qui
        </button>
      </div>
    </div>
  );
}
