/**
 * StopDetailV2.jsx (V2)
 * Scheda fermata con design V2: arrivi con ArrivalRow, CTA tragitto.
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStop, getArrivals } from '../../utils/api';
import { useArrivals } from '../../hooks/useArrivals';
import { formatStopName, extractStopCode } from '../../utils/formatters';
import useFavoritesStore from '../../store/favoritesStore';
import ArrivalRow from '../../components/v2/ArrivalRow';

// Restituisce l'ora corrente arrotondata ai 30 minuti più vicini (HH:MM)
function roundedNowTime() {
  const now = new Date();
  const minutes = now.getMinutes() < 15 ? 0 : now.getMinutes() < 45 ? 30 : 0;
  const hours   = now.getMinutes() >= 45 ? now.getHours() + 1 : now.getHours();
  return `${String(hours % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Restituisce la data odierna come YYYY-MM-DD (ora locale Europe/Rome)
function todayDateStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function ArrivalsV2({ stopId }) {
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useArrivals(stopId, 30);

  const [showPicker,   setShowPicker]   = useState(false);
  const [searchDate,   setSearchDate]   = useState(todayDateStr);
  const [searchTime,   setSearchTime]   = useState(roundedNowTime);
  const [searchResult, setSearchResult] = useState(null);
  const [searching,    setSearching]    = useState(false);
  const [searchError,  setSearchError]  = useState(null);

  const handleSearch = async () => {
    setSearching(true);
    setSearchError(null);
    try {
      const result = await getArrivals(stopId, 30, { date: searchDate, time: searchTime });
      setSearchResult(result);
    } catch (e) {
      setSearchError('Impossibile caricare gli arrivi per la data/ora indicata.');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchResult(null);
    setSearchError(null);
  };

  // ── Skeleton ───────────────────────────────────────────────────────────────
  const SkeletonRows = ({ n = 5 }) => (
    <div className="v2-list">
      {[...Array(n)].map((_, i) => (
        <div key={i} style={{
          height: 64, background: 'var(--v2-surface-2)',
          borderRadius: 'var(--v2-r-md)', marginBottom: 2,
          animation: 'v2-pulse 1.4s ease-in-out infinite',
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
    </div>
  );

  // ── Picker toolbar ─────────────────────────────────────────────────────────
  const pickerSection = (
    <>
      {showPicker && (
        <div style={{
          background: 'var(--v2-surface-2)',
          borderRadius: 'var(--v2-r-md)',
          padding: '12px 14px',
          marginBottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="date"
              value={searchDate}
              onChange={e => setSearchDate(e.target.value)}
              style={{
                flex: 1, padding: '8px 10px', fontSize: 14,
                background: 'var(--v2-bg)', border: '1px solid var(--v2-border)',
                borderRadius: 'var(--v2-r-sm)', color: 'var(--v2-text-1)',
                fontFamily: 'inherit',
              }}
            />
            <input
              type="time"
              value={searchTime}
              onChange={e => setSearchTime(e.target.value)}
              style={{
                flex: 1, padding: '8px 10px', fontSize: 14,
                background: 'var(--v2-bg)', border: '1px solid var(--v2-border)',
                borderRadius: 'var(--v2-r-sm)', color: 'var(--v2-text-1)',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchDate || !searchTime}
            style={{
              background: 'var(--v2-brand)', color: '#fff',
              border: 'none', borderRadius: 'var(--v2-r-md)',
              padding: '10px 0', fontSize: 14, fontWeight: 700,
              fontFamily: 'inherit', cursor: searching ? 'not-allowed' : 'pointer',
              opacity: searching ? 0.7 : 1,
            }}
          >
            {searching ? 'Ricerca…' : 'Cerca'}
          </button>
        </div>
      )}
    </>
  );

  // ── Sezione risultati ricerca ──────────────────────────────────────────────
  if (searchResult) {
    return (
      <div>
        {pickerSection}
        {/* Banner intervallo */}
        <div style={{
          background: 'var(--v2-surface-2)', borderRadius: 'var(--v2-r-md)',
          padding: '8px 12px', marginBottom: 10,
          fontSize: 12, color: 'var(--v2-text-2)',
        }}>
          Dal <strong>{searchResult.rangeFrom}</strong> al <strong>{searchResult.rangeTo}</strong>
        </div>

        {searchResult.arrivals.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--v2-text-3)' }}>
            Nessun arrivo trovato in questo intervallo
          </div>
        ) : (
          <div className="v2-list">
            {searchResult.arrivals.map((a, i) => (
              <ArrivalRow key={i} arrival={a} fetchedAt={null} />
            ))}
          </div>
        )}

        <button
          onClick={clearSearch}
          className="v2-btn"
          style={{
            marginTop: 12, width: '100%', fontSize: 13,
            background: 'var(--v2-surface-2)', color: 'var(--v2-text-2)',
          }}
        >
          ← Torna agli arrivi live
        </button>
      </div>
    );
  }

  // ── Sezione live ───────────────────────────────────────────────────────────
  const arrivals = data?.arrivals ?? [];
  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  if (isLoading) {
    return (
      <>
        {pickerSection}
        <SkeletonRows />
      </>
    );
  }

  if (isError) {
    return (
      <>
        {pickerSection}
        {searchError && (
          <div style={{ fontSize: 13, color: 'var(--v2-danger, #e53935)', marginBottom: 10 }}>
            {searchError}
          </div>
        )}
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--v2-text-3)', marginBottom: 12 }}>
            Impossibile caricare gli arrivi
          </div>
          <button onClick={refetch} className="v2-btn v2-btn-primary" style={{ fontSize: 13 }}>
            Riprova
          </button>
        </div>
      </>
    );
  }

  if (!arrivals.length) {
    return (
      <>
        {pickerSection}
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--v2-text-3)' }}>
          Nessun arrivo nelle prossime ore
        </div>
      </>
    );
  }

  return (
    <div>
      {/* Toolbar: label + toggle picker */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        {updatedAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--v2-text-3)' }}>
              Aggiornato alle {updatedAt}
            </span>
            <span className="v2-rt-dot" />
          </div>
        )}
        <button
          onClick={() => { setShowPicker(p => !p); setSearchError(null); }}
          style={{
            background: showPicker ? 'var(--v2-brand)' : 'var(--v2-surface-2)',
            color: showPicker ? '#fff' : 'var(--v2-text-2)',
            border: 'none', borderRadius: 'var(--v2-r-pill)',
            padding: '5px 12px', fontSize: 12, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          🗓 Cerca per data
        </button>
      </div>

      {searchError && (
        <div style={{ fontSize: 13, color: 'var(--v2-danger, #e53935)', marginBottom: 8 }}>
          {searchError}
        </div>
      )}

      {pickerSection}

      <div className="v2-list">
        {arrivals.map((a, i) => <ArrivalRow key={i} arrival={a} fetchedAt={dataUpdatedAt} />)}
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
  const stopCode = stop?.stop_code || (stop ? extractStopCode(stop.stop_name) : null) || null;
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
