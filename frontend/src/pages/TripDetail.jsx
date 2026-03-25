/**
 * TripDetail.jsx
 * Dettaglio di una corsa specifica con tracking veicolo in tempo reale.
 *
 * URL: /journey/trip/:tripId?fromStop=<stopId>&toStop=<stopId>
 *
 * Struttura:
 *   1. Header: chip linea + headsign + "Da X → A Y" (se fromStop/toStop presenti)
 *   2. Notice "corsa terminata" (se remainingStops === 0)
 *   3. VehicleTracker: stato posizione realtime
 *   4. Card riepilogo: fermate totali, percorse, rimanenti, ritardo
 *   5. TripTimeline: lista fermate con status visivo
 *   6. Barra rt-status-bar con timestamp
 *
 * Auto-refresh ogni 30s (via useTripDetail).
 * Accessibile anche senza fromStop/toStop (mostra la corsa completa).
 */

import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTripDetail } from '../hooks/useTripDetail';
import TripTimeline from '../components/TripTimeline';
import VehicleTracker from '../components/VehicleTracker';
import { SkeletonList } from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import { formatStopName, getRouteTypeInfo } from '../utils/formatters';

export default function TripDetail() {
  const { tripId }         = useParams();
  const [searchParams]     = useSearchParams();
  const navigate           = useNavigate();

  const fromStop = searchParams.get('fromStop');
  const toStop   = searchParams.get('toStop');

  const { data, isLoading, isError, refetch, dataUpdatedAt } =
    useTripDetail(tripId, fromStop, toStop, 30);

  const route    = data?.route;
  const typeInfo = route ? getRouteTypeInfo(route.routeType) : null;
  const chipStyle = route?.routeColor
    ? { backgroundColor: route.routeColor, color: route.routeTextColor || '#fff' }
    : null;

  // Nomi fermate di partenza/arrivo per il subtitle
  const fromStopName = fromStop && data?.stops
    ? formatStopName(data.stops.find(s => s.stopId === fromStop)?.stopName || '') || ''
    : null;
  const toStopName = toStop && data?.stops
    ? formatStopName(data.stops.find(s => s.stopId === toStop)?.stopName || '') || ''
    : null;

  const isTerminated = data?.summary?.remainingStops === 0 && data?.summary?.totalStops > 0;

  const updatedTime = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('it-IT', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : null;

  return (
    <div className="page">
      {/* Header sticky */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Back button — stesso stile di StopDetail */}
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, color: 'var(--color-brand)',
            }}
            aria-label="Torna indietro"
          >
            <svg width="10" height="17" viewBox="0 0 10 17" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M9 1L1 8.5 9 16" />
            </svg>
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            {isLoading ? (
              <>
                <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 14, width: '80%' }} />
              </>
            ) : route ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    className={`route-chip ${chipStyle ? 'custom' : typeInfo?.cssClass}`}
                    style={chipStyle ?? undefined}
                  >
                    {route.routeShortName}
                  </span>
                  <span className="page-title truncate" style={{ fontSize: 18 }}>
                    {route.headsign}
                  </span>
                </div>
                {fromStopName && toStopName ? (
                  <div className="page-subtitle truncate">
                    {fromStopName} → {toStopName}
                  </div>
                ) : (
                  <div className="page-subtitle">{route.routeLongName}</div>
                )}
              </>
            ) : (
              <div className="page-title" style={{ fontSize: 18 }}>Dettaglio corsa</div>
            )}
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && <SkeletonList rows={8} />}

      {/* Errore */}
      {isError && (
        <ErrorState onRetry={refetch} message="Impossibile caricare i dati della corsa" />
      )}

      {/* Contenuto principale */}
      {!isLoading && !isError && data && (
        <div style={{
          paddingTop: 'var(--space-md)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-md)',
        }}>

          {/* Avviso corsa terminata */}
          {isTerminated && (
            <div className="notice notice-warning" style={{ margin: '0 var(--space-md)' }}>
              <span>🏁</span>
              <span>Questa corsa è terminata · vengono mostrati gli orari schedulati</span>
            </div>
          )}

          {/* Vehicle tracker (solo se corsa non terminata) */}
          {!isTerminated && (
            <div>
              <div className="section-label">Posizione veicolo</div>
              <VehicleTracker
                vehicle={data.vehicle}
                realtimeAvailable={data.realtimeAvailable}
                routeColor={route?.routeColor}
                summary={data.summary}
              />
            </div>
          )}

          {/* Card riepilogo numerico */}
          {data.summary && (
            <div className="card card-padded" style={{ margin: '0 var(--space-md)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
                <div>
                  <div className="text-xs text-2">Fermate totali</div>
                  <div className="fw-700" style={{ fontSize: 18 }}>
                    {data.summary.totalStops}
                  </div>
                </div>

                {!isTerminated && (
                  <>
                    <div>
                      <div className="text-xs text-2">Percorse</div>
                      <div className="fw-700" style={{ fontSize: 18, color: 'var(--color-text-3)' }}>
                        {data.summary.passedStops}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-2">Rimanenti</div>
                      <div className="fw-700" style={{ fontSize: 18 }}>
                        {data.summary.remainingStops}
                      </div>
                    </div>
                  </>
                )}

                {data.summary.delayMinutes !== null && (
                  <div>
                    <div className="text-xs text-2">Ritardo</div>
                    <div className="fw-700" style={{
                      fontSize: 18,
                      color: data.summary.delayMinutes > 1
                        ? 'var(--color-danger)'
                        : data.summary.delayMinutes < -1
                        ? 'var(--color-info)'
                        : 'var(--color-success)',
                    }}>
                      {data.summary.delayMinutes > 0
                        ? `+${data.summary.delayMinutes} min`
                        : data.summary.delayMinutes < 0
                        ? `${data.summary.delayMinutes} min`
                        : 'In orario'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline fermate */}
          <div>
            <div className="section-label">
              Percorso · {data.summary?.totalStops} fermate
            </div>
            <div
              className="card"
              style={{ margin: '0 var(--space-md)', overflow: 'visible' }}
            >
              <div style={{ padding: 'var(--space-md) 0' }}>
                <TripTimeline
                  stops={data.stops}
                  fromStopId={fromStop}
                  toStopId={toStop}
                />
              </div>
            </div>
          </div>

          {/* Barra stato con timestamp */}
          <div className="rt-status-bar" style={{ margin: '0 var(--space-md)' }}>
            {data.realtimeAvailable ? (
              <>
                <span className="realtime-dot" />
                <span>Aggiornamento automatico ogni 30s</span>
              </>
            ) : (
              <span>📅 Orari programmati ufficiali GTT</span>
            )}
            {updatedTime && (
              <span style={{ marginLeft: 'auto' }}>Aggiornato {updatedTime}</span>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
