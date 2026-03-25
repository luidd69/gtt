/**
 * Nearby.jsx
 * Fermate vicine con:
 *  - geolocalizzazione automatica
 *  - chip linee disponibili per ogni fermata
 *  - prossimi 2 arrivi per ogni fermata
 *  - fallback HTTPS con messaggio e uso Torino centro
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getNearbyStops, getArrivals } from '../utils/api';
import { useGeolocation } from '../hooks/useGeolocation';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import { getRouteTypeInfo, formatWait } from '../utils/formatters';

const TORINO_CENTER = { lat: 45.0703, lon: 7.6869 };

// ─── Avviso HTTPS ────────────────────────────────────────────────────────────

function HttpsWarning({ onUseDefault }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div className="notice notice-warning">
        <span aria-hidden="true">🔒</span>
        <div>
          <div className="fw-600">HTTPS richiesto per la geolocalizzazione</div>
          <div style={{ marginTop: 4 }}>
            I browser bloccano l'accesso alla posizione GPS su connessioni HTTP.
            Puoi visualizzare le fermate vicino al centro di Torino.
          </div>
        </div>
      </div>
      <button className="btn btn-secondary btn-full" onClick={onUseDefault}
        style={{ minHeight: 48 }}>
        Mostra fermate vicino a Torino centro
      </button>
    </div>
  );
}

// ─── Chip linea compatta ────────────────────────────────────────────────────

function RouteChip({ route }) {
  const info = getRouteTypeInfo(route.routeType);
  const style = route.routeColor
    ? { backgroundColor: route.routeColor, color: route.routeTextColor || '#fff' }
    : null;
  return (
    <span
      className={`route-chip ${style ? 'custom' : info.cssClass}`}
      style={style ?? undefined}
      aria-label={`Linea ${route.routeShortName}`}
    >
      {route.routeShortName}
    </span>
  );
}

// ─── Prossimi arrivi per una fermata ────────────────────────────────────────

function StopArrivals({ stopId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['arrivals', stopId, 'nearby'],
    queryFn: () => getArrivals(stopId, 3),
    staleTime: 25_000,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        {[1, 2].map(i => (
          <div key={i} className="skeleton" style={{ height: 22, width: 70, borderRadius: 6 }} />
        ))}
      </div>
    );
  }

  const arrivals = data?.arrivals?.slice(0, 3) || [];
  if (!arrivals.length) {
    return <span className="text-xs text-3" style={{ paddingTop: 4 }}>Nessun passaggio imminente</span>;
  }

  return (
    <div style={{ display: 'flex', gap: 6, paddingTop: 4, flexWrap: 'wrap' }}>
      {arrivals.map((arr, idx) => {
        const waitText = formatWait(arr.waitMinutes, arr.scheduledTime);
        const isRt = arr.dataType === 'realtime';
        const isDelayed = arr.delayMinutes > 1;
        return (
          <div key={idx} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px',
            background: 'var(--color-bg)',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--color-border)',
          }}>
            {isRt && <span className="realtime-dot" style={{ width: 5, height: 5 }} />}
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: arr.waitMinutes != null && arr.waitMinutes < 3
                ? 'var(--color-danger)' : 'var(--color-text)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {waitText}
            </span>
            {isDelayed && (
              <span style={{ fontSize: 10, color: 'var(--color-danger)' }}>
                +{arr.delayMinutes}
              </span>
            )}
            <span className="text-xs text-3 truncate" style={{ maxWidth: 80 }}>
              {arr.headsign}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Card fermata vicina ────────────────────────────────────────────────────

function NearbyStopCard({ stop }) {
  const distanceText = stop.distanceM < 1000
    ? `${stop.distanceM} m`
    : `${(stop.distanceM / 1000).toFixed(1)} km`;

  return (
    <Link
      to={`/stops/${stop.stop_id}`}
      className="list-item"
      style={{ textDecoration: 'none', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
    >
      {/* Riga principale: nome + distanza */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fw-600 truncate" style={{ fontSize: 15 }}>
            {stop.stop_name}
          </div>
          {stop.stop_code && (
            <div className="text-xs text-2">#{stop.stop_code}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-2)', fontVariantNumeric: 'tabular-nums' }}>
            {distanceText}
          </span>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
            stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round"
            aria-hidden="true">
            <path d="M1 1l5 5-5 5"/>
          </svg>
        </div>
      </div>

      {/* Chip linee */}
      {stop.routes?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {stop.routes.map(r => <RouteChip key={r.routeId} route={r} />)}
        </div>
      )}

      {/* Prossimi arrivi */}
      <StopArrivals stopId={stop.stop_id} />
    </Link>
  );
}

// ─── Pagina principale ───────────────────────────────────────────────────────

export default function Nearby() {
  const { position, error, loading, requestLocation } = useGeolocation();
  const [manualPosition, setManualPosition] = useState(null);

  const isHttpsError = error === 'HTTPS_REQUIRED';
  const activePosition = position || manualPosition;

  useEffect(() => {
    requestLocation();
  }, []);

  const { data, isLoading: stopsLoading, isError, refetch } = useQuery({
    queryKey: ['nearby', activePosition?.lat, activePosition?.lon],
    queryFn: () => getNearbyStops(activePosition.lat, activePosition.lon, 0.75),
    enabled: !!activePosition,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const stopCount = data?.stops?.length ?? 0;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">Vicino a me</div>
            {activePosition && (
              <div className="page-subtitle">
                {position ? `${stopCount} fermate entro 750 m` : 'Torino centro · 750 m'}
              </div>
            )}
          </div>
          {activePosition && (
            <button
              onClick={refetch}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 8, color: 'var(--color-brand)', fontSize: 20,
              }}
              aria-label="Aggiorna posizione"
              title="Aggiorna"
            >
              ↻
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* Loading geo */}
        {!activePosition && !error && loading && (
          <LoadingSpinner message="Rilevamento posizione..." />
        )}

        {/* Errore HTTPS */}
        {isHttpsError && !manualPosition && (
          <HttpsWarning onUseDefault={() => setManualPosition(TORINO_CENTER)} />
        )}

        {/* Errore geolocalizzazione generico */}
        {error && !isHttpsError && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div className="notice notice-warning">
              <span aria-hidden="true">📍</span>
              <span>{error}</span>
            </div>
            <button className="btn btn-primary btn-full" onClick={requestLocation}
              style={{ minHeight: 48 }}>
              Riprova a rilevare posizione
            </button>
          </div>
        )}

        {/* Primo avvio */}
        {!activePosition && !error && !loading && (
          <div className="empty-state">
            <div className="empty-state-icon">📍</div>
            <p className="empty-state-title">Trova fermate vicino a te</p>
            <p className="empty-state-msg">
              Consenti l'accesso alla posizione per vedere le fermate GTT più vicine
              con i prossimi arrivi.
            </p>
            <button className="btn btn-primary" onClick={requestLocation} style={{ minHeight: 48 }}>
              Usa la mia posizione
            </button>
          </div>
        )}

        {/* Loading fermate */}
        {activePosition && stopsLoading && (
          <LoadingSpinner message="Ricerca fermate vicine..." />
        )}

        {/* Errore API */}
        {activePosition && isError && (
          <ErrorState onRetry={refetch} message="Impossibile caricare le fermate vicine" />
        )}

        {/* Risultati */}
        {activePosition && data?.stops && (
          <>
            {data.stops.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🚏</div>
                <p className="empty-state-title">Nessuna fermata trovata</p>
                <p className="empty-state-msg">
                  Non ci sono fermate GTT entro 750 m dalla tua posizione.
                </p>
              </div>
            ) : (
              <div className="list-card">
                {data.stops.map(stop => (
                  <NearbyStopCard key={stop.stop_id} stop={stop} />
                ))}
              </div>
            )}

            {/* Indicatore dati */}
            <div className="rt-status-bar" style={{ marginTop: 'var(--space-sm)' }}>
              <span className="realtime-dot" />
              <span>Aggiornamento automatico ogni 30 s</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
