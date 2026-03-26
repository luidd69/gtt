/**
 * ItineraryDetailV2.jsx
 * Vista step-by-step di un itinerario pianificato (stile Google Maps).
 *
 * Riceve `location.state.itinerary` con legs, orari, fermate.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import RouteChip from '../../components/v2/RouteChip';
import { getRouteTypeInfo } from '../../utils/formatters';

// ─── Icone modalità ───────────────────────────────────────────────────────────

function ModeIcon({ mode, size = 18 }) {
  const icons = {
    WALK:   '🚶',
    BUS:    '🚌',
    TRAM:   '🚃',
    SUBWAY: '🚇',
    RAIL:   '🚆',
    FERRY:  '⛴️',
  };
  return <span style={{ fontSize: size }}>{icons[mode] ?? '🚌'}</span>;
}

// ─── Dot colorato sulla timeline ──────────────────────────────────────────────

function TimelineDot({ color = 'var(--v2-text-3)', size = 12, ring = false }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: ring ? 'transparent' : color,
      border: ring ? `2.5px solid ${color}` : 'none',
      flexShrink: 0,
    }} />
  );
}

// ─── Riga fermata (inizio/fine leg transit) ────────────────────────────────────

function StopRow({ time, name, stopCode, isStart, isEnd, isTransfer, color }) {
  let dotColor;
  if (isStart)    dotColor = 'var(--v2-on-time)';
  else if (isEnd) dotColor = 'var(--v2-brand)';
  else if (isTransfer) dotColor = 'var(--v2-rt-color)';
  else            dotColor = color || 'var(--v2-text-3)';

  const dotSize = isStart || isEnd ? 14 : isTransfer ? 13 : 10;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
      {/* Colonna sinistra: dot */}
      <div style={{ width: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <TimelineDot color={dotColor} size={dotSize} ring={isEnd && !isStart} />
      </div>
      {/* Contenuto */}
      <div style={{ flex: 1, paddingBottom: 4, paddingLeft: 4 }}>
        {(isStart || isEnd || isTransfer) && (
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.8px',
            textTransform: 'uppercase',
            color: isStart ? 'var(--v2-on-time)' : isEnd ? 'var(--v2-brand)' : 'var(--v2-rt-color)',
            marginBottom: 1,
          }}>
            {isStart ? 'Sali' : isEnd ? 'Scendi' : 'Cambio'}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontVariantNumeric: 'tabular-nums',
            fontSize: 15, fontWeight: 700,
            color: 'var(--v2-text-1)',
            minWidth: 40,
          }}>{time}</span>
          <span style={{
            fontSize: isStart || isEnd || isTransfer ? 15 : 14,
            color: isStart || isEnd || isTransfer ? 'var(--v2-text-1)' : 'var(--v2-text-2)',
            fontWeight: isStart || isEnd || isTransfer ? 600 : 400,
          }}>{name}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Connettore verticale con descrizione leg ─────────────────────────────────

function LegConnector({ leg, isWalk }) {
  const lineColor = isWalk ? 'var(--v2-walk)' : (leg.route?.color || 'var(--v2-bus)');
  const lineBg    = isWalk
    ? 'repeating-linear-gradient(to bottom, var(--v2-walk) 0px, var(--v2-walk) 4px, transparent 4px, transparent 8px)'
    : lineColor;

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, minHeight: isWalk ? 48 : 64 }}>
      {/* Linea verticale */}
      <div style={{ width: 36, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{
          width: isWalk ? 2 : 6,
          background: lineBg,
          borderRadius: 3,
        }} />
      </div>

      {/* Descrizione */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center',
        padding: '8px 4px 8px 8px',
      }}>
        {isWalk ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15 }}>🚶</span>
            <span style={{ fontSize: 13, color: 'var(--v2-text-2)' }}>
              A piedi · {leg.durationMin} min
              {leg.distanceM > 0 && ` · ${leg.distanceM < 1000 ? `${leg.distanceM}m` : `${(leg.distanceM / 1000).toFixed(1)}km`}`}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <ModeIcon mode={leg.mode} size={14} />
              {leg.route && (
                <RouteChip route={{
                  route_short_name: leg.route.shortName,
                  route_type: leg.route.type ?? 3,
                  route_color: leg.route.color?.replace('#', ''),
                  route_text_color: leg.route.textColor?.replace('#', ''),
                }} />
              )}
              {/* headsign con fallback su longName */}
              {(leg.headsign || leg.route?.longName) && (
                <span style={{ fontSize: 12, color: 'var(--v2-text-2)' }}>
                  dir. {leg.headsign || leg.route.longName}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--v2-text-3)' }}>
              {leg.durationMin} min
              {leg.stopsCount > 1 && ` · ${leg.stopsCount} fermate`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ItineraryDetailV2() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const itinerary = state?.itinerary;
  const fromStop  = state?.fromStop;
  const toStop    = state?.toStop;

  // GPS proximity alert
  const [gpsCoords,  setGpsCoords]  = useState(null);   // { lat, lon } — aggiornati da watchPosition
  const [alertType,  setAlertType]  = useState(null);   // null | { type:'dest'|'transfer', name, nextLine? }
  const [gpsActive,  setGpsActive]  = useState(false);
  const [gpsBlocked, setGpsBlocked] = useState(false);
  const watchIdRef   = useRef(null);
  const lastCheckRef = useRef(0);   // throttle: controlla al massimo ogni 12s

  // Avvia GPS
  useEffect(() => {
    if (!itinerary || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsActive(true);
        setGpsCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => { if (err.code === 1) setGpsBlocked(true); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [itinerary]);

  // Controlla prossimità fermate (throttled, no await dentro watchPosition)
  useEffect(() => {
    if (!gpsCoords || !itinerary) return;
    const now = Date.now();
    if (now - lastCheckRef.current < 12000) return; // al massimo ogni 12s
    lastCheckRef.current = now;

    const transitLegs = itinerary.legs?.filter(l => l.mode !== 'WALK') || [];
    if (!transitLegs.length) return;

    // Raccoglie tutti gli stopId rilevanti: cambi + destinazione finale
    const checkPoints = [
      // Fermate di cambio intermedie
      ...transitLegs.slice(0, -1).map(l => ({
        stopId:   l.to?.stopId,
        name:     l.to?.name,
        type:     'transfer',
        nextLine: transitLegs[transitLegs.indexOf(l) + 1]?.route?.shortName,
      })),
      // Destinazione finale
      {
        stopId: transitLegs[transitLegs.length - 1].to?.stopId,
        name:   transitLegs[transitLegs.length - 1].to?.name,
        type:   'dest',
      },
    ].filter(cp => cp.stopId);

    fetch(`/api/stops/nearby?lat=${gpsCoords.lat}&lon=${gpsCoords.lon}&radius=0.35`)
      .then(r => r.json())
      .then(d => {
        const nearbyIds = new Set((d.stops || []).map(s => s.stop_id));
        // Controlla prima i cambi (priorità), poi la destinazione
        for (const cp of checkPoints) {
          if (nearbyIds.has(cp.stopId)) {
            setAlertType({ type: cp.type, name: cp.name, nextLine: cp.nextLine });
            return;
          }
        }
        setAlertType(null);
      })
      .catch(() => {});
  }, [gpsCoords, itinerary]);

  if (!itinerary) {
    navigate('/v2/journey', { replace: true });
    return null;
  }

  const { legs = [], departureTime, arrivalTime, durationMin, transfers, walkMin, walkDistanceM } = itinerary;

  const transferLabel = transfers === 0 ? 'diretto' : `${transfers} ${transfers === 1 ? 'cambio' : 'cambi'}`;

  // Indice dell'ultimo leg di transito (per mostrare la fermata di arrivo finale)
  const lastTransitIdx = [...legs].map((l, i) => i).filter(i => legs[i].mode !== 'WALK').at(-1) ?? -1;

  return (
    <div className="v2-page" style={{ paddingBottom: 80 }}>
      {/* Header con back button */}
      <div className="v2-header" style={{ paddingBottom: 'var(--v2-sp-md)' }}>
        <button
          onClick={() => navigate(-1)}
          className="v2-btn v2-btn-secondary"
          style={{ minHeight: 36, padding: '0 14px', fontSize: 13, marginBottom: 12, alignSelf: 'flex-start' }}
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 1L1 6l5 5"/>
          </svg>
          Risultati
        </button>

        {/* From → To */}
        <div style={{ fontSize: 11, color: 'var(--v2-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
          Percorso
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--v2-text-1)' }}>
            {fromStop?.stopName ?? legs[0]?.from?.name ?? '—'}
          </span>
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="var(--v2-text-3)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M1 5h12M8 1l4 4-4 4"/>
          </svg>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--v2-text-1)' }}>
            {toStop?.stopName ?? legs[legs.length - 1]?.to?.name ?? '—'}
          </span>
        </div>
      </div>

      {/* Summary card */}
      <div style={{ padding: '0 var(--v2-sp-md)', marginBottom: 20 }}>

        {/* Alert avvicinamento destinazione */}
        {alertType?.type === 'dest' && (
          <div style={{
            background: 'linear-gradient(135deg,#15803D,#166534)',
            borderRadius: 'var(--v2-r-md)', padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          }}>
            <span style={{ fontSize: 22 }}>🔔</span>
            <div style={{ flex: 1, color: 'white' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Stai per arrivare!</div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                Preparati a scendere a <b>{alertType.name}</b>
              </div>
            </div>
            <button onClick={() => setAlertType(null)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'white', fontSize: 12, fontWeight: 600 }}>
              OK
            </button>
          </div>
        )}

        {/* Alert cambio mezzo */}
        {alertType?.type === 'transfer' && (
          <div style={{
            background: 'linear-gradient(135deg,#B45309,#92400E)',
            borderRadius: 'var(--v2-r-md)', padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          }}>
            <span style={{ fontSize: 22 }}>🔔</span>
            <div style={{ flex: 1, color: 'white' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Preparati al cambio!</div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                Scendi a <b>{alertType.name}</b>
                {alertType.nextLine && <span> — prendi la linea <b>{alertType.nextLine}</b></span>}
              </div>
            </div>
            <button onClick={() => setAlertType(null)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'white', fontSize: 12, fontWeight: 600 }}>
              OK
            </button>
          </div>
        )}

        {/* GPS attivo — nessun alert in corso */}
        {gpsActive && !alertType && (
          <div style={{
            background: 'var(--v2-surface-2)', borderRadius: 'var(--v2-r-sm)',
            padding: '8px 12px', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
            color: 'var(--v2-text-2)', border: '1px solid var(--v2-border)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', flexShrink: 0, display: 'inline-block' }} />
            GPS attivo — ti avviseremo quando sei vicino a fermate di cambio o destinazione
          </div>
        )}
        {gpsBlocked && (
          <div style={{ fontSize: 11, color: 'var(--v2-text-3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🔒</span> Avvisi GPS non disponibili: permesso posizione negato
          </div>
        )}
        <div className="v2-itin-summary v2-animate-in v2-animate-in-d1">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="v2-arrival-time" style={{ fontSize: 26 }}>{departureTime}</span>
              <span style={{ color: 'var(--v2-text-3)', fontSize: 14 }}>→</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--v2-text-1)' }}>{arrivalTime}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--v2-text-1)', flexShrink: 0 }}>
              {durationMin}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--v2-text-3)', marginLeft: 3 }}>min</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="v2-badge on-time">🔄 {transferLabel}</span>
            {walkMin > 0 && (
              <span className="v2-badge scheduled">
                🚶 {walkMin}min a piedi
                {walkDistanceM > 0 && ` (${walkDistanceM < 1000 ? `${walkDistanceM}m` : `${(walkDistanceM / 1000).toFixed(1)}km`})`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ padding: '0 var(--v2-sp-md)' }}>
        <div className="v2-section-label">Come andare</div>

        <div
          className="v2-animate-in v2-animate-in-d2"
          style={{
            background: 'var(--v2-surface-1)',
            borderRadius: 'var(--v2-r-lg)',
            border: '1px solid var(--v2-border)',
            padding: '16px 12px',
            boxShadow: 'var(--v2-shadow-sm)',
          }}
        >
          {/* Punto di partenza (solo se il primo leg è WALK) */}
          {legs[0]?.mode === 'WALK' && (
            <>
              <StopRow
                time={legs[0].startTime}
                name={legs[0].from.name || fromStop?.stopName || 'Partenza'}
                stopCode={legs[0].from.stopCode}
                isStart
              />
              <LegConnector leg={legs[0]} isWalk />
            </>
          )}

          {legs.map((leg, i) => {
            if (leg.mode === 'WALK') {
              if (i === 0) return null;
              // Walk intermedio: fermata di cambio + connettore walk
              return (
                <div key={i} className={`v2-animate-in v2-animate-in-d${Math.min(i + 2, 6)}`}>
                  <StopRow
                    time={leg.startTime}
                    name={leg.from.name}
                    stopCode={leg.from.stopCode}
                    isTransfer
                  />
                  <LegConnector leg={leg} isWalk />
                </div>
              );
            }

            // Leg di transito
            const isFirstTransit = i === 0 || (i === 1 && legs[0].mode === 'WALK');
            const isLastTransit  = i === lastTransitIdx;

            return (
              <div key={i} className={`v2-animate-in v2-animate-in-d${Math.min(i + 2, 6)}`}>
                {/* Fermata inizio transit (non già mostrata sopra da walk intermedio) */}
                {!(i > 0 && legs[i - 1]?.mode === 'WALK') && (
                  <StopRow
                    time={leg.startTime}
                    name={leg.from.name}
                    stopCode={leg.from.stopCode}
                    isStart={isFirstTransit}
                    color={leg.route?.color}
                  />
                )}

                {/* Linea colorata + info */}
                <LegConnector leg={leg} isWalk={false} />

                {/* Fermata fine transit */}
                <StopRow
                  time={leg.endTime}
                  name={leg.to.name}
                  stopCode={leg.to.stopCode}
                  isEnd={isLastTransit && (i === legs.length - 1 || legs[i + 1]?.mode !== 'WALK')}
                  isTransfer={!isLastTransit && legs[i + 1]?.mode === 'WALK'}
                  color={leg.route?.color}
                />

                {/* Bottone dettaglio corsa */}
                {leg.tripId && (
                  <div style={{ paddingLeft: 44, paddingBottom: 6, marginTop: 2 }}>
                    <button
                      onClick={() => navigate(`/trips/${leg.tripId}`, {
                        state: { fromStop: leg.from.stopId, toStop: leg.to.stopId }
                      })}
                      className="v2-btn v2-btn-secondary"
                      style={{ minHeight: 36, padding: '0 12px', fontSize: 12 }}
                    >
                      Vedi corsa in tempo reale
                      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M1 1l5 5-5 5"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Destinazione finale (se l'ultimo leg è WALK) */}
          {legs[legs.length - 1]?.mode === 'WALK' && (
            <StopRow
              time={legs[legs.length - 1].endTime}
              name={legs[legs.length - 1].to.name || toStop?.stopName || 'Arrivo'}
              stopCode={legs[legs.length - 1].to.stopCode}
              isEnd
            />
          )}
        </div>
      </div>
    </div>
  );
}
