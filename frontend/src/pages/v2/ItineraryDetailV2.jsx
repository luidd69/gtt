/**
 * ItineraryDetailV2.jsx
 * Vista step-by-step di un itinerario pianificato (stile Google Maps).
 *
 * Riceve `location.state.itinerary` con legs, orari, fermate.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import RouteChip from '../../components/v2/RouteChip';
import { scheduleReminder as persistReminder, requestNotificationPermission, getUiReminders } from '../../utils/notifications';

// ─── Icone modalità ───────────────────────────────────────────────────────────

const MODE_ICONS = { WALK:'🚶', BUS:'🚌', TRAM:'🚃', SUBWAY:'🚇', RAIL:'🚆', FERRY:'⛴️' };

// ─── Leg a piedi: segmento tratteggiato compatto ──────────────────────────────

function WalkLeg({ leg }) {
  const dist = leg.distanceM > 0
    ? (leg.distanceM < 1000 ? ` (${leg.distanceM} m)` : ` (${(leg.distanceM/1000).toFixed(1)} km)`)
    : '';
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 40 }}>
      {/* Linea tratteggiata */}
      <div style={{ width: 36, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{
          width: 2,
          background: 'repeating-linear-gradient(to bottom,var(--v2-walk) 0,var(--v2-walk) 5px,transparent 5px,transparent 10px)',
        }} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 4px 8px 10px' }}>
        <svg width="13" height="18" viewBox="0 0 10 14" fill="none" stroke="var(--v2-walk)" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="5" cy="2" r="1.2"/><path d="M5 4v4l-2 4M5 8l2 4M3 6h4"/>
        </svg>
        <span style={{ fontSize: 13, color: 'var(--v2-walk)', fontWeight: 500 }}>
          A piedi {leg.durationMin} min{dist}
        </span>
      </div>
    </div>
  );
}

// ─── Leg transit: timeline con tutte le fermate ───────────────────────────────

function TransitLeg({ leg, navigate, gpsActive, onSchedule, setActiveReminders }) {
  const lineColor = leg.route?.color || 'var(--v2-bus)';

  // Reminder: quale stop ha il pannello aperto (stopId o null)
  const [reminderForStop, setReminderForStop] = useState(null);
  const [reminderMins, setReminderMins] = useState(5);

  // Fetcha le fermate reali dal backend (solo tra isFrom e isTo)
  const [stops, setStops] = useState(null);
  useEffect(() => {
    if (!leg.tripId) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (leg.from?.stopId) params.set('fromStop', leg.from.stopId);
    if (leg.to?.stopId)   params.set('toStop',   leg.to.stopId);
    fetch(`/api/journey/trip/${leg.tripId}?${params}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (!data.stops) return;
        const fromIdx = data.stops.findIndex(s => s.isFrom);
        const toIdx   = data.stops.findIndex(s => s.isTo);
        if (fromIdx !== -1 && toIdx !== -1 && toIdx > fromIdx) {
          setStops(data.stops.slice(fromIdx, toIdx + 1));
        }
      })
      .catch(err => { if (err.name !== 'AbortError') console.error('[TransitLeg] fetch trip stops:', err); });
    return () => controller.abort();
  }, [leg.tripId, leg.from?.stopId, leg.to?.stopId]);

  // Fallback se non ancora caricato: from + intermediateStops OTP + to
  const displayStops = stops ?? [
    { stopId: leg.from?.stopId, stopName: leg.from?.name, departureTime: leg.startTime, _isBoardingOnly: true },
    ...(leg.intermediateStops ?? []).map(s => ({ stopName: s.name || s.gtfsId })),
    { stopId: leg.to?.stopId,   stopName: leg.to?.name,  arrivalTime: leg.endTime, _isAlightingOnly: true },
  ];

  const isBoarding  = (s, i) => i === 0;
  const isAlighting = (s, i) => i === displayStops.length - 1;

  return (
    <div>
      {/* Header segmento: badge linea + direzione + status RT */}
      <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 36 }}>
        <div style={{ width: 36, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 5, background: lineColor, borderRadius: '3px 3px 0 0' }} />
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 4px 10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14 }}>{MODE_ICONS[leg.mode] ?? '🚌'}</span>
          <RouteChip
            shortName={leg.route?.shortName || leg.mode}
            routeType={leg.route?.type ?? 3}
            color={leg.route?.color}
            textColor={leg.route?.textColor}
            size="lg"
          />
          {(leg.headsign || leg.route?.longName) && (
            <span style={{ fontSize: 12, color: 'var(--v2-text-2)' }}>
              dir. {leg.headsign || leg.route.longName}
            </span>
          )}
          <span style={{ fontSize: 11, color: leg.realTime ? 'var(--v2-on-time)' : 'var(--v2-text-3)', display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: leg.realTime ? 'var(--v2-on-time)' : 'var(--v2-text-3)', display: 'inline-block' }}/>
            {leg.realTime ? 'Tempo reale' : 'Orario previsto'}
          </span>
        </div>
      </div>

      {/* Fermate del tragitto */}
      {displayStops.map((stop, i) => {
        const boarding  = isBoarding(stop, i);
        const alighting = isAlighting(stop, i);
        const isMiddle  = !boarding && !alighting;
        const isLast    = alighting;

        const time = boarding
          ? (stop.departureTime ?? leg.startTime)
          : alighting
            ? (stop.arrivalTime ?? leg.endTime)
            : (stop.departureTime ?? null);

        const dotColor = boarding ? 'var(--v2-on-time)' : alighting ? lineColor : lineColor;
        const dotSize  = boarding || alighting ? 12 : 7;

        const stopKey = stop.stopId || `stop-${i}`;
        const hasReminder = gpsActive && time && (boarding || alighting);

        return (
          <div key={stopKey}>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              {/* Colonna timeline */}
              <div style={{ width: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                {/* Linea sopra il dot (tranne il primo) */}
                {!boarding && (
                  <div style={{ width: 5, height: isMiddle ? 10 : 6, background: lineColor, flexShrink: 0 }} />
                )}
                {/* Dot */}
                <div style={{
                  width: dotSize, height: dotSize,
                  borderRadius: '50%',
                  background: alighting ? 'transparent' : dotColor,
                  border: alighting ? `2.5px solid ${lineColor}` : 'none',
                  flexShrink: 0, zIndex: 1,
                }} />
                {/* Linea sotto il dot (tranne l'ultimo) */}
                {!isLast && (
                  <div style={{ width: 5, flex: 1, minHeight: isMiddle ? 10 : 8, background: lineColor, flexShrink: 0 }} />
                )}
              </div>

              {/* Contenuto fermata */}
              <div style={{
                flex: 1,
                paddingLeft: 10,
                paddingBottom: isLast ? 2 : isMiddle ? 6 : 10,
                paddingTop: boarding ? 0 : isMiddle ? 2 : 4,
                display: 'flex', alignItems: 'baseline', gap: 8,
              }}>
                {boarding && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--v2-on-time)', letterSpacing: '0.8px', textTransform: 'uppercase', flexShrink: 0, alignSelf: 'center' }}>↑ Sali</span>
                )}
                {alighting && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: lineColor, letterSpacing: '0.8px', textTransform: 'uppercase', flexShrink: 0, alignSelf: 'center' }}>↓ Scendi</span>
                )}
                {time && (
                  <span style={{ fontSize: boarding || alighting ? 15 : 12, fontWeight: boarding || alighting ? 700 : 400, color: 'var(--v2-text-1)', fontVariantNumeric: 'tabular-nums', minWidth: 36, flexShrink: 0 }}>
                    {time}
                  </span>
                )}
                <span style={{
                  fontSize: boarding || alighting ? 14 : 12,
                  fontWeight: boarding || alighting ? 600 : 400,
                  color: boarding || alighting ? 'var(--v2-text-1)' : 'var(--v2-text-3)',
                  flex: 1,
                }}>
                  {stop.stopName}
                </span>
                {/* Pulsante reminder ⏰ — solo per fermate con orario */}
                {hasReminder && (
                  <button
                    onClick={() => setReminderForStop(reminderForStop === stopKey ? null : stopKey)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 14, padding: '0 2px', opacity: 0.6,
                      flexShrink: 0, alignSelf: 'center',
                    }}
                    title="Imposta reminder"
                  >⏰</button>
                )}
              </div>
            </div>

            {/* Pannello reminder inline */}
            {reminderForStop === stopKey && (
              <div style={{
                marginLeft: 46, marginBottom: 8, marginTop: 2,
                background: 'var(--v2-surface-2)', borderRadius: 'var(--v2-r-sm)',
                padding: '10px 12px', border: '1px solid var(--v2-border)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--v2-text-2)', marginBottom: 8, fontWeight: 600 }}>
                  Avvisami prima di {time} ({stop.stopName})
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[2, 5, 10, 15].map(m => (
                    <button
                      key={m}
                      onClick={() => setReminderMins(m)}
                      style={{
                        padding: '4px 10px', fontSize: 12, border: '1px solid var(--v2-border)',
                        borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                        background: reminderMins === m ? 'var(--v2-brand)' : 'var(--v2-surface-1)',
                        color: reminderMins === m ? '#fff' : 'var(--v2-text-1)',
                        fontWeight: reminderMins === m ? 700 : 400,
                      }}
                    >{m} min</button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const r = onSchedule(stop.stopName, time, reminderMins);
                    if (r) {
                      setActiveReminders(prev => [...prev, r]);
                    }
                    setReminderForStop(null);
                  }}
                  style={{
                    width: '100%', padding: '8px', fontSize: 13,
                    background: 'var(--v2-brand)', color: '#fff',
                    border: 'none', borderRadius: 'var(--v2-r-sm)',
                    cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit',
                  }}
                >
                  Imposta reminder
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Bottone dettaglio corsa */}
      {leg.tripId && (
        <div style={{ paddingLeft: 46, paddingBottom: 8, paddingTop: 4 }}>
          <button
            onClick={() => navigate(`/trips/${leg.tripId}`, {
              state: { fromStop: leg.from?.stopId, toStop: leg.to?.stopId }
            })}
            className="v2-btn v2-btn-secondary"
            style={{ minHeight: 32, padding: '0 12px', fontSize: 11 }}
          >
            Vedi corsa in tempo reale
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 1l5 5-5 5"/></svg>
          </button>
        </div>
      )}
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

  // "Sono a bordo" + notifiche browser
  const [onBoard, setOnBoard] = useState(false);
  const [notifPerm, setNotifPerm] = useState(() => {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  });
  const alertFiredRef = useRef(new Set()); // stopId già notificati, per non ripetere

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

    const controller = new AbortController();
    fetch(`/api/stops/nearby?lat=${gpsCoords.lat}&lon=${gpsCoords.lon}&radius=0.35`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        const nearbyIds = new Set((d.stops || []).map(s => s.stop_id));
        // Controlla prima i cambi (priorità), poi la destinazione
        for (const cp of checkPoints) {
          if (nearbyIds.has(cp.stopId)) {
            setAlertType({ type: cp.type, name: cp.name, nextLine: cp.nextLine });
            // Notifica browser se permesso concesso e utente a bordo
            if (onBoard && typeof Notification !== 'undefined' && Notification.permission === 'granted' && !alertFiredRef.current.has(cp.stopId)) {
              alertFiredRef.current.add(cp.stopId);
              const title = cp.type === 'dest' ? '🔔 Preparati a scendere!' : '🔔 Cambio in arrivo!';
              const body = cp.type === 'dest'
                ? `Stai per arrivare a ${cp.name}`
                : `Scendi a ${cp.name} e prendi la linea ${cp.nextLine || ''}`;
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body, icon: '/favicon.ico', tag: `gtt-${cp.stopId}` })).catch(() => {
                  try { new Notification(title, { body, icon: '/favicon.ico', tag: `gtt-${cp.stopId}` }); } catch {}
                });
              } else {
                try { new Notification(title, { body, icon: '/favicon.ico', tag: `gtt-${cp.stopId}` }); } catch {}
              }
            }
            return;
          }
        }
        setAlertType(null);
      })
      .catch(err => { if (err.name !== 'AbortError') console.error('[GPS] nearby fetch:', err); });
    return () => controller.abort();
  }, [gpsCoords, itinerary, onBoard]);

  const [saved, setSaved] = useState(false);

  // ── Reminder per orario fermata ──
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderStop,   setReminderStop]   = useState(null);  // { name, time }
  const [reminderMinsBefore, setReminderMinsBefore] = useState(5);
  // Carica i reminder pendenti da localStorage (sopravvivono al refresh)
  const [activeReminders, setActiveReminders] = useState(() =>
    getUiReminders()
      .filter(r => r.tag?.startsWith('gtt-stop-reminder-') && r.fireAt > Date.now())
      .map(r => ({ id: r.id, stopName: r.body?.replace(/^Tra poco passi per: /, '') ?? '', fireAt: r.fireAt, label: r.body ?? '', fired: false }))
  );

  if (!itinerary) {
    navigate('/v2/journey', { replace: true });
    return null;
  }

  const { legs = [], departureTime, arrivalTime, durationMin, transfers, walkMin, walkDistanceM } = itinerary;

  const transferLabel = transfers === 0 ? 'diretto' : `${transfers} ${transfers === 1 ? 'cambio' : 'cambi'}`;

  function scheduleStopReminder(stopName, timeStr, minsBefore) {
    const [hh, mm] = timeStr.split(':').map(Number);
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
    target.setMinutes(target.getMinutes() - minsBefore);
    if (target.getTime() <= Date.now()) return null; // già passato
    const id = `stop-${stopName}-${timeStr}-${Date.now()}`;
    const fireAt = target.getTime();
    persistReminder({
      id,
      title: '⏰ Reminder fermata GTT',
      body: `Tra poco passi per: ${stopName}`,
      tag: `gtt-stop-reminder-${id}`,
      fireAt,
    }).catch(err => console.error('[Reminder] Errore scheduling fermata:', err));
    return { id, stopName, timeStr, minsBefore, fireAt, fired: false, label: `${minsBefore} min prima di ${timeStr} (${stopName})` };
  }

  return (
    <div className="v2-page" style={{ paddingBottom: 120 }}>
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

        {/* Pannello "Sono a bordo" */}
        {gpsActive && !gpsBlocked && (
          <div style={{ marginBottom: 12 }}>
            {!onBoard ? (
              <button
                onClick={async () => {
                  const granted = await requestNotificationPermission();
                  setNotifPerm(granted ? 'granted' : (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'));
                  setOnBoard(true);
                  alertFiredRef.current.clear();
                }}
                style={{
                  width: '100%', padding: '12px 16px',
                  background: 'var(--v2-brand)', color: '#fff',
                  border: 'none', borderRadius: 'var(--v2-r-md)',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{ fontSize: 20 }}>🚌</span>
                <div style={{ textAlign: 'left' }}>
                  <div>Sono a bordo</div>
                  <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>
                    Ti avvisiamo quando devi scendere
                  </div>
                </div>
              </button>
            ) : (
              <div style={{
                background: 'var(--v2-brand-tint-2)', borderRadius: 'var(--v2-r-md)',
                padding: '10px 14px', border: '1px solid var(--v2-brand)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 18 }}>🚌</span>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--v2-text-1)', fontWeight: 600 }}>
                  Monitoraggio attivo
                  {notifPerm !== 'granted' && (
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--v2-text-3)', marginTop: 2 }}>
                      Abilita le notifiche nel browser per avvisi in background
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setOnBoard(false); alertFiredRef.current.clear(); }}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--v2-text-2)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
                >
                  Fine
                </button>
              </div>
            )}
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
            padding: '14px 10px 10px',
            boxShadow: 'var(--v2-shadow-sm)',
          }}
        >
          {/* Punto di partenza assoluto (solo nome, nessuna linea sopra) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 2 }}>
            <div style={{ width: 36, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--v2-text-3)', border: '2px solid var(--v2-bg)' }} />
            </div>
            <span style={{ fontSize: 13, color: 'var(--v2-text-2)', paddingLeft: 10, fontWeight: 500 }}>
              {legs[0]?.from?.name || fromStop?.stopName || 'Partenza'}
            </span>
          </div>

          {/* Loop legs */}
          {legs.map((leg, i) => (
            <div key={i} className={`v2-animate-in v2-animate-in-d${Math.min(i + 1, 6)}`}>
              {leg.mode === 'WALK'
                ? <WalkLeg leg={leg} />
                : <TransitLeg leg={leg} navigate={navigate} gpsActive={gpsActive} onSchedule={scheduleStopReminder} setActiveReminders={setActiveReminders} />
              }
            </div>
          ))}

          {/* Punto di arrivo assoluto */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 2 }}>
            <div style={{ width: 36, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'transparent', border: '2.5px solid var(--v2-brand)' }} />
            </div>
            <span style={{ fontSize: 14, color: 'var(--v2-text-1)', paddingLeft: 10, fontWeight: 700 }}>
              {legs[legs.length - 1]?.to?.name || toStop?.stopName || 'Arrivo'}
            </span>
          </div>
        </div>
      </div>

      {/* Reminder attivi */}
      {activeReminders.filter(r => !r.fired).length > 0 && (
        <div style={{ padding: '0 var(--v2-sp-md)', marginTop: 12 }}>
          <div className="v2-section-label">Reminder attivi</div>
          <div className="v2-card" style={{ padding: '8px 12px' }}>
            {activeReminders.filter(r => !r.fired).map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--v2-divider)' }}>
                <span style={{ fontSize: 16 }}>⏰</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--v2-text-1)' }}>{r.label}</span>
                <button
                  onClick={() => setActiveReminders(prev => prev.filter(x => x.id !== r.id))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v2-text-3)', fontSize: 12 }}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA fissi in basso — stile Google Maps */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 600,
        background: 'var(--v2-bg)', borderTop: '1px solid var(--v2-border)',
        padding: '12px var(--v2-sp-md)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', gap: 10, zIndex: 50,
      }}>
        <button
          className="v2-btn v2-btn-primary"
          style={{ flex: 1, fontSize: 15, minHeight: 46 }}
          onClick={() => {
            const firstLeg = legs.find(l => l.mode !== 'WALK');
            if (firstLeg?.tripId) {
              navigate(`/trips/${firstLeg.tripId}`, {
                state: { fromStop: firstLeg.from.stopId, toStop: firstLeg.to.stopId }
              });
            }
          }}
        >
          Avvia
        </button>
        <button
          className="v2-btn v2-btn-secondary"
          style={{ minWidth: 80, fontSize: 15, minHeight: 46, gap: 6 }}
          onClick={() => setSaved(s => !s)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          {saved ? 'Salvato' : 'Salva'}
        </button>
      </div>
    </div>
  );
}
