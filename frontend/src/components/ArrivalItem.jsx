/**
 * ArrivalItem.jsx
 * Singola riga di arrivo con supporto orario statico e realtime.
 * Click → mappa veicoli con tracking automatico sul tripId.
 */

import { useNavigate } from 'react-router-dom';
import { getRouteTypeInfo, formatWait, truncateHeadsign } from '../utils/formatters';

export default function ArrivalItem({ arrival }) {
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
  } = arrival;

  const typeInfo = getRouteTypeInfo(routeType);
  const chipStyle = (routeColor && routeColor !== '#null')
    ? { backgroundColor: routeColor, color: routeTextColor || '#fff' }
    : null;

  const isRealtime = dataType === 'realtime';
  const isSoon = waitMinutes !== null && waitMinutes < 3;
  const isDelayed = delayMinutes !== null && delayMinutes > 1;

  const displayTime = realtimeTime || scheduledTime;
  const waitText = formatWait(waitMinutes, displayTime);

  const handleClick = () => {
    if (tripId) navigate(`/map?tripId=${encodeURIComponent(tripId)}`);
  };

  return (
    <div
      className="arrival-item"
      onClick={handleClick}
      role={tripId ? 'button' : undefined}
      tabIndex={tripId ? 0 : undefined}
      onKeyDown={tripId ? (e) => e.key === 'Enter' && handleClick() : undefined}
      style={{ cursor: tripId ? 'pointer' : 'default' }}
      aria-label={tripId ? `Vedi posizione veicolo linea ${routeShortName}` : undefined}
    >
      {/* Chip linea */}
      <span
        className={`route-chip ${chipStyle ? 'custom' : typeInfo.cssClass}`}
        style={chipStyle ?? undefined}
        aria-label={`Linea ${routeShortName}`}
      >
        {routeShortName}
      </span>

      {/* Destinazione */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="truncate fw-600" style={{ fontSize: 15 }}>
          {truncateHeadsign(headsign)}
        </div>
        <div className="flex-row gap-xs" style={{ marginTop: 2 }}>
          {isRealtime && (
            <span className="realtime-dot" title="Dati in tempo reale" />
          )}
          {isDelayed && (
            <span className="delay-badge">+{delayMinutes} min</span>
          )}
          {isRealtime && !isDelayed && delayMinutes === 0 && (
            <span className="on-time-badge">In orario</span>
          )}
          {!isRealtime && (
            <span className="text-xs text-3">Programmato</span>
          )}
        </div>
      </div>

      {/* Orario + attesa + icona mappa */}
      <div className="arrival-time-block">
        {isDelayed && (
          <span className="arrival-scheduled">{scheduledTime}</span>
        )}
        <span className={`arrival-time${isSoon ? ' soon' : ''}`}>
          {isSoon ? waitText : displayTime}
        </span>
        <span className="arrival-wait" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {isSoon ? scheduledTime : waitText}
          {tripId && (
            <span style={{ fontSize: 11, color: 'var(--color-text-3)', marginLeft: 2 }}>📍</span>
          )}
        </span>
      </div>
    </div>
  );
}
