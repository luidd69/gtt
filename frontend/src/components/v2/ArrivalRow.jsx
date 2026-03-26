/**
 * ArrivalRow.jsx (V2)
 * Riga arrivo con numero linea, destinazione, orario grande e badge stato.
 * Click → mappa veicolo.
 */

import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { truncateHeadsign, formatWait } from '../../utils/formatters';
import RouteChip from './RouteChip';
import DelayBadge from './DelayBadge';

export default function ArrivalRow({ arrival, fetchedAt }) {
  const navigate = useNavigate();
  const {
    tripId,
    routeShortName,
    routeType,
    routeColor,
    routeTextColor,
    headsign,
    scheduledTime,
    realtimeTime,
    waitMinutes,
    delayMinutes,
    dataType,
    canceled,
    nextDay,
    nextDayDate,
  } = arrival;

  // Countdown live: decrementa ogni 10s in base al tempo passato dal fetch
  const [liveWait, setLiveWait] = useState(waitMinutes);
  useEffect(() => {
    if (waitMinutes === null || waitMinutes === undefined) return;
    const update = () => {
      const elapsed = fetchedAt ? (Date.now() - fetchedAt) / 60_000 : 0;
      setLiveWait(Math.max(0, Math.round(waitMinutes - elapsed)));
    };
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, [waitMinutes, fetchedAt]);

  const isRealtime  = dataType === 'realtime';
  const isSoon      = liveWait !== null && liveWait < 3;
  const displayTime = realtimeTime || scheduledTime;
  const waitText    = formatWait(liveWait, displayTime);

  // Mostra orario aggiornato solo se diverso da quello programmato
  const hasTimeShift = isRealtime && realtimeTime && scheduledTime && realtimeTime !== scheduledTime;
  const shiftLabel = hasTimeShift
    ? (delayMinutes > 0
        ? `+${delayMinutes} min ritardo`
        : `${Math.abs(delayMinutes)} min anticipo`)
    : null;

  const handleClick = () => {
    if (tripId) navigate(`/map?tripId=${encodeURIComponent(tripId)}`);
  };

  return (
    <div
      className="v2-list-item"
      onClick={handleClick}
      role={tripId ? 'button' : undefined}
      tabIndex={tripId ? 0 : undefined}
      onKeyDown={tripId ? (e) => e.key === 'Enter' && handleClick() : undefined}
      style={{
        cursor: tripId ? 'pointer' : 'default',
        opacity: canceled ? 0.6 : nextDay ? 0.7 : 1,
        // Corse del giorno dopo: leggero bordo a sinistra grigio
        borderLeft: nextDay ? '2px solid var(--v2-text-3)' : undefined,
        paddingLeft: nextDay ? 'calc(var(--v2-sp-md) - 2px)' : undefined,
      }}
      aria-label={tripId ? `Vedi veicolo linea ${routeShortName}` : undefined}
    >
      {/* Chip linea */}
      <RouteChip
        shortName={routeShortName}
        routeType={routeType}
        color={routeColor !== '#null' ? routeColor : null}
        textColor={routeTextColor}
        size="lg"
      />

      {/* Destinazione + stato */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="v2-truncate v2-fw-600"
          style={{
            fontSize: 15,
            textDecoration: canceled ? 'line-through' : 'none',
            color: 'var(--v2-text-1)',
          }}
        >
          {truncateHeadsign(headsign)}
        </div>
        <div className="v2-row v2-gap-xs" style={{ marginTop: 4, alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
          {/* Badge "Domani DD/MM" per corse notturne/mattutine del giorno dopo */}
          {nextDay && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 10, fontWeight: 700,
              color: 'var(--v2-text-3)',
              background: 'var(--v2-surface-2)',
              border: '1px solid var(--v2-border)',
              borderRadius: 3,
              padding: '1px 5px',
              letterSpacing: 0.3,
              textTransform: 'uppercase',
            }}>
              Domani{nextDayDate ? ` ${nextDayDate}` : ''}
            </span>
          )}
          {isRealtime && !canceled && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 11, fontWeight: 700, color: '#3A8FFF',
              background: 'rgba(58,143,255,0.10)',
              border: '1px solid rgba(58,143,255,0.20)',
              borderRadius: 4,
              padding: '1px 6px 1px 4px',
              letterSpacing: 0.1,
            }}>
              {/* WiFi icon */}
              <svg width="12" height="10" viewBox="0 0 24 18" fill="none" stroke="#3A8FFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 6.5C5.5 2.5 18.5 2.5 23 6.5"/>
                <path d="M4.5 10.5C7.5 7.5 16.5 7.5 19.5 10.5"/>
                <path d="M8.5 14.5C10 13 14 13 15.5 14.5"/>
                <circle cx="12" cy="18" r="1.2" fill="#3A8FFF" stroke="none"/>
              </svg>
              Tempo reale
            </span>
          )}
          <DelayBadge
            delayMinutes={delayMinutes}
            dataType={dataType}
            cancelled={canceled}
          />
        </div>
      </div>

      {/* Orario + attesa */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div className={`v2-arrival-time${isSoon ? ' soon' : ''}`}>
          {isSoon ? waitText : displayTime}
        </div>
        {!canceled && shiftLabel && (
          <div style={{
            fontSize: 11, fontWeight: 700, marginTop: 2,
            color: delayMinutes > 0 ? 'var(--v2-delay-heavy, #e8431b)' : 'var(--v2-delay-early, #2e9e5b)',
            letterSpacing: '0.01em',
          }}>
            {shiftLabel}
          </div>
        )}
        <div className="v2-arrival-wait">
          {isSoon ? (realtimeTime || scheduledTime) : waitText}
          {tripId && !canceled && (
            <span style={{ marginLeft: 4, fontSize: 11 }}>📍</span>
          )}
        </div>
      </div>
    </div>
  );
}
