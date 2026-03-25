/**
 * JourneyPlanner.jsx
 * Pagina per la pianificazione del tragitto tra due fermate.
 *
 * Flusso:
 *   1. Utente seleziona fermata di partenza con StopPicker
 *   2. Utente seleziona fermata di arrivo con StopPicker
 *   3. Click "Cerca corse" → mostra lista JourneyResultItem
 *   4. Click su una corsa → naviga a TripDetail
 *
 * La ricerca è esplicita (non automatica) per evitare query inutili
 * mentre l'utente sta ancora scegliendo le fermate.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJourney } from '../hooks/useJourney';
import StopPicker from '../components/StopPicker';
import { SkeletonList } from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import { getRouteTypeInfo } from '../utils/formatters';

// Icona swap (⇅)
function IconSwap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16V4m0 0L3 8m4-4l4 4" />
      <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

/**
 * Singolo risultato di una corsa disponibile.
 */
function JourneyResultItem({ journey, onClick }) {
  const typeInfo  = getRouteTypeInfo(journey.routeType);
  const chipStyle = journey.routeColor ? {
    backgroundColor: journey.routeColor,
    color: journey.routeTextColor || '#fff',
  } : null;

  const isDelayed = journey.realtimeDelay !== null && journey.realtimeDelay > 1;

  return (
    <button className="list-item" onClick={onClick}>
      {/* Chip linea */}
      <span
        className={`route-chip ${chipStyle ? 'custom' : typeInfo.cssClass}`}
        style={chipStyle ?? undefined}
      >
        {journey.routeShortName}
      </span>

      {/* Info corsa */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fw-600 truncate">{journey.headsign}</div>
        <div className="flex-row gap-xs" style={{ marginTop: 2 }}>
          {journey.dataType === 'realtime' && <span className="realtime-dot" />}
          <span className="text-xs text-2">
            {journey.intermediateStops} ferm. · {journey.durationMinutes} min
          </span>
          {isDelayed && (
            <span className="delay-badge">+{journey.realtimeDelay} min</span>
          )}
        </div>
      </div>

      {/* Orario partenza/arrivo */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        flexShrink: 0, gap: 2,
      }}>
        <span style={{
          fontSize: 20, fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text)',
        }}>
          {journey.departureTime}
        </span>
        <span className="text-xs text-2">{journey.arrivalTime} arr.</span>
      </div>

      {/* Chevron */}
      <svg className="chevron" width="8" height="13" viewBox="0 0 8 13" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M1 1l6 5.5L1 12" />
      </svg>
    </button>
  );
}

export default function JourneyPlanner() {
  const navigate = useNavigate();

  const [fromStop, setFromStop] = useState(null);
  const [toStop,   setToStop]   = useState(null);
  // searched: true solo dopo che l'utente clicca "Cerca corse"
  const [searched, setSearched] = useState(false);

  const { data, isLoading, isError, error, refetch } = useJourney(
    fromStop?.stop_id,
    toStop?.stop_id,
    searched
  );

  const handleSearch = useCallback(() => {
    if (fromStop && toStop && fromStop.stop_id !== toStop.stop_id) {
      setSearched(true);
      // Se già in stato searched, invalida la cache per re-fetch
      if (searched) refetch();
    }
  }, [fromStop, toStop, searched, refetch]);

  const handleSwap = useCallback(() => {
    setFromStop(toStop);
    setToStop(fromStop);
    // Resetta i risultati per evitare di mostrare risultati della direzione opposta
    setSearched(false);
  }, [fromStop, toStop]);

  const handleJourneySelect = useCallback((journey) => {
    const params = new URLSearchParams();
    if (fromStop) params.set('fromStop', fromStop.stop_id);
    if (toStop)   params.set('toStop',   toStop.stop_id);
    navigate(`/journey/trip/${journey.tripId}?${params.toString()}`);
  }, [navigate, fromStop, toStop]);

  const isSameStop  = fromStop && toStop && fromStop.stop_id === toStop.stop_id;
  const canSearch   = fromStop && toStop && !isSameStop;
  const journeys    = data?.journeys || [];

  return (
    <div className="page">
      {/* Header sticky con i selettori fermate */}
      <div className="page-header">
        <div className="page-title">Tragitto</div>
        <div className="page-subtitle">Trova corse tra due fermate</div>

        <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {/* Riga partenza + swap */}
          <div style={{ position: 'relative' }}>
            <StopPicker
              value={fromStop}
              onChange={(stop) => { setFromStop(stop); setSearched(false); }}
              placeholder="Fermata di partenza…"
            />
          </div>

          {/* Bottone swap centrato tra i due picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <button
              onClick={handleSwap}
              disabled={!fromStop && !toStop}
              style={{
                width: 36, height: 36,
                border: '2px solid var(--color-border)',
                borderRadius: '50%',
                background: 'var(--color-bg-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-card)',
                color: 'var(--color-text-2)',
                flexShrink: 0,
              }}
              aria-label="Inverti partenza e arrivo"
            >
              <IconSwap />
            </button>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>

          <StopPicker
            value={toStop}
            onChange={(stop) => { setToStop(stop); setSearched(false); }}
            placeholder="Fermata di arrivo…"
          />

          {isSameStop && (
            <p style={{ fontSize: 12, color: 'var(--color-danger)', padding: '0 var(--space-sm)' }}>
              Seleziona due fermate diverse
            </p>
          )}

          <button
            className="btn btn-primary btn-full"
            onClick={handleSearch}
            disabled={!canSearch}
            style={{ marginTop: 'var(--space-xs)' }}
          >
            Cerca corse
          </button>
        </div>
      </div>

      {/* Contenuto principale */}
      <div style={{ paddingTop: 'var(--space-md)' }}>

        {/* Stato iniziale: nessuna ricerca ancora effettuata */}
        {!searched && (
          <div className="empty-state">
            <div className="empty-state-icon">🗺️</div>
            <p className="empty-state-title">Pianifica il tragitto</p>
            <p className="empty-state-msg">
              Seleziona una fermata di partenza e una di arrivo,
              poi cerca le corse disponibili nelle prossime 2 ore
            </p>
          </div>
        )}

        {/* Loading */}
        {searched && isLoading && <SkeletonList rows={4} />}

        {/* Errore */}
        {searched && isError && (
          <ErrorState
            onRetry={refetch}
            message={error?.response?.data?.error || 'Impossibile calcolare il percorso'}
          />
        )}

        {/* Nessuna corsa trovata */}
        {searched && !isLoading && !isError && journeys.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <p className="empty-state-title">Nessuna corsa trovata</p>
            <p className="empty-state-msg">
              {data?.message || 'Nessuna corsa diretta nei prossimi 120 minuti'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
              Le fermate potrebbero non essere collegate da una linea diretta
            </p>
          </div>
        )}

        {/* Lista corse disponibili */}
        {searched && !isLoading && !isError && journeys.length > 0 && (
          <div>
            <div className="section-label">
              {journeys.length} {journeys.length === 1 ? 'corsa disponibile' : 'corse disponibili'}
            </div>

            <div className="list-card" style={{ margin: '0 var(--space-md)' }}>
              {journeys.map(j => (
                <JourneyResultItem
                  key={`${j.tripId}-${j.departureTime}`}
                  journey={j}
                  onClick={() => handleJourneySelect(j)}
                />
              ))}
            </div>

            {/* Barra stato realtime */}
            <div className="rt-status-bar" style={{ margin: 'var(--space-sm) var(--space-md) 0' }}>
              {data.realtimeAvailable ? (
                <>
                  <span className="realtime-dot" />
                  <span>Orari in tempo reale</span>
                </>
              ) : (
                <span>📅 Orari programmati ufficiali</span>
              )}
              {data.generatedAt && (
                <span style={{ marginLeft: 'auto' }}>
                  {new Date(data.generatedAt).toLocaleTimeString('it-IT', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
