/**
 * Metro.jsx
 * Sezione dedicata alla metropolitana di Torino (Linea 1 M1).
 *
 * Tab "Linea":     mappa delle stazioni per direzione
 * Tab "Percorso":  pianificazione viaggio tra due stazioni con tempi dettagliati
 */

import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMetroInfo } from '../utils/api';
import { useMetroJourney } from '../hooks/useMetroJourney';
import LoadingSpinner, { SkeletonList } from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';

// ─── Icone ───────────────────────────────────────────────────────────────────

function IconSwap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16V4m0 0L3 8m4-4l4 4" />
      <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

function IconChevron({ open }) {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
      <path d="M1 1l5 5 5-5" />
    </svg>
  );
}

// ─── Componenti stazione ──────────────────────────────────────────────────────

function MetroStationItem({ stop, color }) {
  return (
    <Link to={`/stops/${stop.stop_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', cursor: 'pointer', transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-input)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            border: `2.5px solid ${color}`, background: 'var(--color-bg-card)',
            flexShrink: 0, zIndex: 1,
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fw-600" style={{ fontSize: 15 }}>{stop.stop_name}</div>
          {stop.stop_code && <div className="text-xs text-2">#{stop.stop_code}</div>}
        </div>
        {stop.departure_time && (
          <span style={{ fontSize: 13, color: 'var(--color-text-2)', fontVariantNumeric: 'tabular-nums' }}>
            {stop.departure_time.substring(0, 5)}
          </span>
        )}
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
          stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round">
          <path d="M1 1l5 5-5 5" />
        </svg>
      </div>
    </Link>
  );
}

function DirectionSection({ direction, color }) {
  const [expanded, setExpanded] = useState(false);
  const stops = direction.stops || [];
  const visibleStops = expanded ? stops : stops.slice(0, 5);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px var(--space-md)',
        background: color + '15', borderBottom: `1px solid ${color}30`,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <div>
          <div className="text-xs fw-600" style={{ color, textTransform: 'uppercase', letterSpacing: 0.5 }}>Direzione</div>
          <div className="fw-700" style={{ fontSize: 16 }}>{direction.headsign}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-2)' }}>
          {stops.length} fermate
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 29, top: 20, bottom: 20,
          width: 2, background: color + '40', zIndex: 0,
        }} />
        {visibleStops.map(stop => (
          <MetroStationItem key={stop.stop_id} stop={stop} color={color} />
        ))}
      </div>

      {stops.length > 5 && (
        <button onClick={() => setExpanded(!expanded)}
          className="btn btn-ghost btn-full"
          style={{ borderRadius: 0, padding: '12px', fontSize: 14 }}>
          {expanded ? 'Mostra meno ▲' : `Mostra tutte le ${stops.length} fermate ▼`}
        </button>
      )}
    </div>
  );
}

// ─── Selettore stazione metro ─────────────────────────────────────────────────

function MetroStationPicker({ label, value, onChange, allStops, color, excludeStopId }) {
  const available = allStops.filter(s => s.stop_id !== excludeStopId);

  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <select
        value={value?.stop_id || ''}
        onChange={e => {
          const found = allStops.find(s => s.stop_id === e.target.value);
          onChange(found || null);
        }}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          border: value ? `2px solid ${color}` : '1.5px solid var(--color-border)',
          background: 'var(--color-bg-input)',
          color: 'var(--color-text)',
          fontSize: 15,
          fontWeight: value ? 600 : 400,
          appearance: 'none',
          WebkitAppearance: 'none',
          cursor: 'pointer',
          outline: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M1 1l5 5 5-5'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: 32,
        }}
      >
        <option value="">Seleziona stazione…</option>
        {available.map(s => (
          <option key={s.stop_id} value={s.stop_id}>{s.stop_name}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Badge tempo ──────────────────────────────────────────────────────────────

function TimeBadge({ label, minutes, color, emoji }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      flex: 1, padding: '10px 6px',
      background: 'var(--color-bg-input)',
      borderRadius: 'var(--radius-md)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 18 }}>{emoji}</div>
      <div style={{
        fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        color: color || 'var(--color-text)', lineHeight: 1.1, marginTop: 2,
      }}>
        {minutes}<span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-2)' }}> min</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-2)', marginTop: 3, lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}

// ─── Timeline fermate metro ───────────────────────────────────────────────────

function MetroStopTimeline({ stops, color }) {
  if (!stops?.length) return null;
  return (
    <div style={{ paddingTop: 8 }}>
      {stops.map((stop, i) => {
        const isEndpoint = stop.isFrom || stop.isTo || stop.isTransfer;
        return (
          <div key={`${stop.stopId}-${i}`} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            paddingBottom: i < stops.length - 1 ? 0 : 0,
            position: 'relative',
          }}>
            {/* Linea verticale + dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0, paddingTop: 2 }}>
              {/* Linea verticale sopra (tranne primo) */}
              {i > 0 && (
                <div style={{ width: 2, height: 10, background: stop.isTransfer ? '#888' : color + '60', marginBottom: 0 }} />
              )}
              {i === 0 && <div style={{ height: 10 }} />}

              <div style={{
                width: stop.isFrom || stop.isTo ? 14 : stop.isTransfer ? 12 : 8,
                height: stop.isFrom || stop.isTo ? 14 : stop.isTransfer ? 12 : 8,
                borderRadius: '50%',
                background: stop.isFrom ? 'var(--color-success)'
                  : stop.isTo ? 'var(--color-danger)'
                  : stop.isTransfer ? '#888'
                  : color,
                border: isEndpoint ? '2.5px solid var(--color-bg-card)' : 'none',
                boxShadow: isEndpoint ? `0 0 0 2px ${stop.isFrom ? 'var(--color-success)' : stop.isTo ? 'var(--color-danger)' : '#888'}` : 'none',
                flexShrink: 0,
                zIndex: 1,
              }} />

              {/* Linea verticale sotto (tranne ultimo) */}
              {i < stops.length - 1 && (
                <div style={{ width: 2, flex: 1, minHeight: 16, background: color + '60' }} />
              )}
            </div>

            <div style={{ flex: 1, paddingBottom: 12, paddingTop: 2 }}>
              <Link to={`/stops/${stop.stopId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                  fontSize: isEndpoint ? 14 : 13,
                  fontWeight: isEndpoint ? 600 : 400,
                  color: 'var(--color-text)',
                  lineHeight: 1.3,
                }}>
                  {stop.stopName}
                </div>
              </Link>
              {stop.isFrom && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-success)', background: 'rgba(48,209,88,0.12)', padding: '1px 6px', borderRadius: 'var(--radius-pill)', display: 'inline-block', marginTop: 2 }}>
                  Partenza
                </span>
              )}
              {stop.isTo && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-danger)', background: 'rgba(255,59,48,0.12)', padding: '1px 6px', borderRadius: 'var(--radius-pill)', display: 'inline-block', marginTop: 2 }}>
                  Arrivo
                </span>
              )}
              {stop.isTransfer && !stop.isFrom && !stop.isTo && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#888', background: 'rgba(128,128,128,0.12)', padding: '1px 6px', borderRadius: 'var(--radius-pill)', display: 'inline-block', marginTop: 2 }}>
                  🔄 Cambio
                </span>
              )}
            </div>

            <div style={{
              fontSize: isEndpoint ? 14 : 12,
              fontWeight: isEndpoint ? 700 : 400,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-text-2)',
              paddingTop: 2, flexShrink: 0,
            }}>
              {stop.departureTime}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Card singolo viaggio metro ───────────────────────────────────────────────

function MetroJourneyCard({ journey, metroColor, onViewTrip }) {
  const [expanded, setExpanded] = useState(false);
  const isDelayed = journey.realtimeDelay !== null && journey.realtimeDelay > 1;
  const hasRealtime = journey.dataType === 'realtime' || (journey.legs && journey.legs.some(l => l.dataType === 'realtime'));

  // Per journeys con transfer, raccoglie le info del leg corrente
  const isDirect = journey.type === 'direct';

  // Fermate da mostrare nella timeline
  const stops = isDirect
    ? journey.stops
    : [...(journey.legs[0].stops), ...(journey.legs[1].stops.slice(1))];

  return (
    <div className="card" style={{ margin: '0 var(--space-md) var(--space-sm)', overflow: 'hidden' }}>
      {/* Header card */}
      <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          {/* Chip linea / badge tipo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isDirect ? (
              <span style={{
                background: journey.routeColor || metroColor,
                color: journey.routeTextColor || '#fff',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px', fontWeight: 700, fontSize: 15,
              }}>
                {journey.routeShortName}
              </span>
            ) : (
              journey.legs.map((leg, i) => (
                <span key={i} style={{
                  background: leg.routeColor || metroColor,
                  color: leg.routeTextColor || '#fff',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px', fontWeight: 700, fontSize: 15,
                }}>
                  {leg.routeShortName}
                </span>
              ))
            )}
            {!isDirect && (
              <span style={{ fontSize: 12, color: 'var(--color-text-2)', background: 'rgba(128,128,128,0.12)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                🔄 Cambio a {journey.transfer.stopName}
              </span>
            )}
          </div>

          {/* Orario di partenza/arrivo */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {journey.departureTime}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-2)' }}>→ {journey.arrivalTime}</div>
          </div>
        </div>

        {/* Direzione */}
        {isDirect && (
          <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 8 }}>
            dir. <span className="fw-600">{journey.headsign}</span>
          </div>
        )}

        {/* Realtime / ritardo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {hasRealtime && <span className="realtime-dot" />}
          {isDelayed && (
            <span className="delay-badge">+{journey.realtimeDelay} min</span>
          )}
          {isDirect && journey.scheduledDeparture !== journey.departureTime && !isDelayed && (
            <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
              Sched. {journey.scheduledDeparture}
            </span>
          )}
          {hasRealtime && !isDelayed && (
            <span style={{ fontSize: 11, color: 'var(--color-success)' }}>In orario</span>
          )}
        </div>

        {/* Breakdown tempi */}
        <div style={{ display: 'flex', gap: 8 }}>
          <TimeBadge
            emoji="⏱️" label="Attesa" minutes={journey.waitMinutes}
            color={journey.waitMinutes <= 5 ? 'var(--color-success)' : journey.waitMinutes <= 15 ? 'var(--color-warning, #ff9500)' : 'var(--color-danger)'}
          />
          <TimeBadge
            emoji="🚇" label="Viaggio" minutes={journey.travelMinutes}
            color={metroColor}
          />
          {!isDirect && journey.transferMinutes > 0 && (
            <TimeBadge
              emoji="🔄" label="Cambio" minutes={journey.transferMinutes}
              color="var(--color-text-2)"
            />
          )}
          <TimeBadge
            emoji="🕐" label="Totale" minutes={journey.totalMinutes}
            color="var(--color-brand)"
          />
        </div>

        {/* Veicolo in tempo reale (solo journeys diretti) */}
        {isDirect && journey.vehicle?.available && (
          <div style={{
            marginTop: 10, padding: '8px 12px',
            background: 'var(--color-brand-light, rgba(0,122,255,0.08))',
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
          }}>
            <span className="realtime-dot" />
            <span>
              Treno in posizione
              {journey.vehicle.currentStatus ? ` — ${journey.vehicle.currentStatus}` : ''}
            </span>
            {journey.vehicleArrivalMinutes !== null && (
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-brand)' }}>
                ~{journey.vehicleArrivalMinutes} min all'arrivo
              </span>
            )}
          </div>
        )}

        {/* Numero fermate intermedie */}
        {isDirect && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--color-text-2)' }}>
            {journey.intermediateStops > 0
              ? `${journey.intermediateStops} ${journey.intermediateStops === 1 ? 'fermata intermedia' : 'fermate intermedie'}`
              : 'Stazioni consecutive'}
          </div>
        )}
      </div>

      {/* Pulsanti azioni */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            flex: 1, padding: '10px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-brand)', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <IconChevron open={expanded} />
          {expanded ? 'Nascondi fermate' : 'Mostra fermate'}
        </button>
        {isDirect && (
          <button
            onClick={() => onViewTrip(journey)}
            style={{
              flex: 1, padding: '10px',
              background: 'none',
              borderLeft: '1px solid var(--color-border)',
              cursor: 'pointer',
              color: 'var(--color-text-2)', fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            Dettaglio corsa →
          </button>
        )}
      </div>

      {/* Timeline fermate (espansa) */}
      {expanded && (
        <div style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
          {isDirect ? (
            <MetroStopTimeline stops={journey.stops} color={journey.routeColor || metroColor} />
          ) : (
            <>
              {/* Leg 1 */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-3)', marginBottom: 4, textTransform: 'uppercase' }}>
                  Linea {journey.legs[0].routeShortName} — dir. {journey.legs[0].headsign}
                </div>
                <MetroStopTimeline stops={journey.legs[0].stops} color={journey.legs[0].routeColor || metroColor} />
              </div>

              {/* Separatore cambio */}
              <div style={{
                margin: '8px 0',
                padding: '10px 14px',
                background: 'rgba(128,128,128,0.08)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                🔄 Cambio a <span className="fw-700">{journey.transfer.stopName}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--color-text-2)', fontWeight: 400 }}>
                  ~{journey.transfer.transferMinutes} min
                </span>
              </div>

              {/* Leg 2 */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-3)', marginBottom: 4, textTransform: 'uppercase' }}>
                  Linea {journey.legs[1].routeShortName} — dir. {journey.legs[1].headsign}
                </div>
                <MetroStopTimeline stops={journey.legs[1].stops} color={journey.legs[1].routeColor || metroColor} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab Percorso ─────────────────────────────────────────────────────────────

function MetroPercorso({ stopsForward, stopsReverse, metroColor }) {
  const navigate = useNavigate();
  const [fromStop, setFromStop] = useState(null);
  const [toStop,   setToStop]   = useState(null);
  const [searched, setSearched] = useState(false);

  // Lista completa per lookup (ricerca per stop_id)
  const allStops = stopsForward;

  const { data, isLoading, isError, error, refetch } = useMetroJourney(
    fromStop?.stop_id,
    toStop?.stop_id,
    searched,
  );

  const handleSearch = useCallback(() => {
    if (fromStop && toStop && fromStop.stop_id !== toStop.stop_id) {
      if (searched) refetch();
      setSearched(true);
    }
  }, [fromStop, toStop, searched, refetch]);

  const handleSwap = useCallback(() => {
    setFromStop(toStop);
    setToStop(fromStop);
    setSearched(false);
  }, [fromStop, toStop]);

  const handleViewTrip = useCallback((journey) => {
    const params = new URLSearchParams();
    if (fromStop) params.set('fromStop', fromStop.stop_id);
    if (toStop)   params.set('toStop',   toStop.stop_id);
    navigate(`/journey/trip/${journey.tripId}?${params.toString()}`);
  }, [navigate, fromStop, toStop]);

  const isSameStop = fromStop && toStop && fromStop.stop_id === toStop.stop_id;
  const canSearch  = fromStop && toStop && !isSameStop;
  const journeys   = data?.journeys || [];

  return (
    <div>
      {/* Selettori stazioni */}
      <div style={{ padding: 'var(--space-md)', background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end', marginBottom: 'var(--space-sm)' }}>
          <MetroStationPicker
            label="Partenza"
            value={fromStop}
            onChange={s => { setFromStop(s); setSearched(false); }}
            allStops={stopsForward}
            color={metroColor}
            excludeStopId={toStop?.stop_id}
          />

          <button
            onClick={handleSwap}
            disabled={!fromStop && !toStop}
            style={{
              width: 38, height: 38, flexShrink: 0, marginBottom: 2,
              border: '2px solid var(--color-border)', borderRadius: '50%',
              background: 'var(--color-bg-card)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--color-text-2)',
            }}
            aria-label="Inverti"
          >
            <IconSwap />
          </button>

          <MetroStationPicker
            label="Arrivo"
            value={toStop}
            onChange={s => { setToStop(s); setSearched(false); }}
            allStops={stopsReverse}
            color={metroColor}
            excludeStopId={fromStop?.stop_id}
          />
        </div>

        {isSameStop && (
          <p style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 'var(--space-xs)' }}>
            Seleziona due stazioni diverse
          </p>
        )}

        <button
          className="btn btn-primary btn-full"
          onClick={handleSearch}
          disabled={!canSearch}
        >
          Cerca corse metro
        </button>
      </div>

      {/* Risultati */}
      <div style={{ paddingTop: 'var(--space-sm)' }}>
        {!searched && (
          <div className="empty-state" style={{ marginTop: 'var(--space-lg)' }}>
            <div className="empty-state-icon">🚇</div>
            <p className="empty-state-title">Pianifica il viaggio</p>
            <p className="empty-state-msg">
              Seleziona la stazione di partenza e quella di arrivo
              per calcolare tempi e fermate del percorso metro
            </p>
          </div>
        )}

        {searched && isLoading && <SkeletonList rows={3} />}

        {searched && isError && (
          <ErrorState
            onRetry={refetch}
            message={error?.response?.data?.error || 'Impossibile calcolare il percorso metro'}
          />
        )}

        {searched && !isLoading && !isError && journeys.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <p className="empty-state-title">Nessuna corsa trovata</p>
            <p className="empty-state-msg">
              {data?.message || `Nessuna corsa metro nei prossimi 90 minuti`}
            </p>
          </div>
        )}

        {searched && !isLoading && !isError && journeys.length > 0 && (
          <>
            <div className="section-label" style={{ paddingLeft: 'var(--space-md)' }}>
              {journeys.length} {journeys.length === 1 ? 'corsa disponibile' : 'corse disponibili'}
            </div>

            {journeys.map((journey, i) => (
              <MetroJourneyCard
                key={`${journey.type}-${journey.departureTime}-${i}`}
                journey={journey}
                metroColor={metroColor}
                onViewTrip={handleViewTrip}
              />
            ))}

            {/* Barra stato */}
            <div className="rt-status-bar" style={{ margin: 'var(--space-sm) var(--space-md) var(--space-md)' }}>
              {data.realtimeAvailable
                ? (<><span className="realtime-dot" /><span>Dati in tempo reale</span></>)
                : (<span>📅 Orari programmati</span>)
              }
              {data.generatedAt && (
                <span style={{ marginLeft: 'auto' }}>
                  Aggiornato {new Date(data.generatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function Metro() {
  const [activeTab, setActiveTab] = useState('linea');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['metro'],
    queryFn: getMetroInfo,
    staleTime: 0,
  });

  // Raccoglie tutte le stazioni metro:
  // - stopsForward: direzione 0 (es. Fermi → Lingotto), ordine reale
  // - stopsReverse: direzione 1 (ordine invertito, es. Lingotto → Fermi)
  const { stopsForward, stopsReverse } = (() => {
    if (!data?.available) return { stopsForward: [], stopsReverse: [] };
    const route = data.routes[0];
    if (!route) return { stopsForward: [], stopsReverse: [] };

    const extractStops = (dir) => {
      if (!dir) return [];
      const seen = new Set();
      return dir.stops
        .filter(s => { if (seen.has(s.stop_id)) return false; seen.add(s.stop_id); return true; })
        .sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0));
    };

    const fwd = extractStops(route.directions[0]);
    // Direzione 1 (opposta) — se assente, inverti la direzione 0
    const rev = route.directions[1]
      ? extractStops(route.directions[1])
      : [...fwd].reverse();

    return { stopsForward: fwd, stopsReverse: rev };
  })();

  // Lista piatta unica (per compatibilità con altri usi)
  const allMetroStops = stopsForward;

  const metroColor = data?.routes?.[0]?.color || '#E84B24';

  const tabStyle = (tab) => ({
    flex: 1, padding: '10px 0',
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: activeTab === tab ? 700 : 400,
    color: activeTab === tab ? metroColor : 'var(--color-text-2)',
    borderBottom: activeTab === tab ? `2.5px solid ${metroColor}` : '2px solid transparent',
    transition: 'all 0.15s',
  });

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>🚇</span>
          <div>
            <div className="page-title">Metropolitana</div>
            <div className="page-subtitle">GTT Torino — Linea M1</div>
          </div>
        </div>

        {/* Tabs */}
        {data?.available && (
          <div style={{ display: 'flex', marginTop: 'var(--space-md)', borderBottom: '1px solid var(--color-border)' }}>
            <button style={tabStyle('linea')} onClick={() => setActiveTab('linea')}>
              🗺️ Linea
            </button>
            <button style={tabStyle('percorso')} onClick={() => setActiveTab('percorso')}>
              🧭 Percorso
            </button>
          </div>
        )}
      </div>

      <div style={{ paddingTop: 'var(--space-sm)' }}>
        {isLoading && <LoadingSpinner message="Caricamento dati metro..." />}
        {isError && <ErrorState onRetry={refetch} message="Impossibile caricare i dati della metropolitana" />}

        {data && !data.available && (
          <div className="empty-state" style={{ marginTop: 'var(--space-xl)' }}>
            <div className="empty-state-icon">🚇</div>
            <p className="empty-state-title">Dati non disponibili</p>
            <p className="empty-state-msg">{data.message}</p>
          </div>
        )}

        {/* Tab: Linea */}
        {data?.available && activeTab === 'linea' && (
          <>
            {data.routes.map(route => (
              <div key={route.routeId}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 'var(--space-md)', borderBottom: '1px solid var(--color-border)',
                }}>
                  <div style={{
                    background: route.color || metroColor, color: 'white',
                    borderRadius: 'var(--radius-sm)', padding: '6px 12px',
                    fontWeight: 700, fontSize: 18, letterSpacing: 1,
                  }}>
                    {route.name}
                  </div>
                  <div>
                    <div className="fw-600">{route.fullName}</div>
                  </div>
                </div>

                {route.directions.map(dir => (
                  <div key={dir.direction_id} className="card" style={{ margin: 'var(--space-md)', overflow: 'hidden' }}>
                    <DirectionSection direction={dir} color={route.color || metroColor} />
                  </div>
                ))}
              </div>
            ))}

            <div className="notice notice-info" style={{ margin: 'var(--space-md)' }}>
              <span>ℹ️</span>
              <div>
                <div>Per gli orari in tempo reale della metro, consulta</div>
                <div>
                  <a href="https://www.gtt.to.it" style={{ color: 'var(--color-brand)' }} target="_blank" rel="noopener">
                    gtt.to.it
                  </a>
                  {' '}o l'app Muoversi a Torino.
                </div>
              </div>
            </div>
          </>
        )}

        {/* Tab: Percorso */}
        {data?.available && activeTab === 'percorso' && (
          <MetroPercorso
            stopsForward={stopsForward}
            stopsReverse={stopsReverse}
            metroColor={metroColor}
          />
        )}
      </div>
    </div>
  );
}
