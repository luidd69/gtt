/**
 * ArrivalRow.jsx (V2)
 * Riga arrivo con numero linea, destinazione, orario grande e badge stato.
 * Click → mappa veicolo.
 */

import { useNavigate } from 'react-router-dom';
import { truncateHeadsign, formatWait } from '../../utils/formatters';
import RouteChip from './RouteChip';
import DelayBadge from './DelayBadge';

export default function ArrivalRow({ arrival }) {
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
  } = arrival;

  const isRealtime = dataType === 'realtime';
  const isSoon     = waitMinutes !== null && waitMinutes < 3;
  const isDelayed  = delayMinutes !== null && delayMinutes > 1;
  const displayTime = realtimeTime || scheduledTime;
  const waitText    = formatWait(waitMinutes, displayTime);

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
        opacity: canceled ? 0.6 : 1,
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
        <div className="v2-row v2-gap-xs" style={{ marginTop: 3 }}>
          {isRealtime && !canceled && (
            <span className="v2-rt-dot" title="Realtime" />
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
        {isDelayed && !canceled && (
          <div className="v2-arrival-scheduled">{scheduledTime}</div>
        )}
        <div className={`v2-arrival-time${isSoon ? ' soon' : ''}`}>
          {isSoon ? waitText : displayTime}
        </div>
        <div className="v2-arrival-wait">
          {isSoon ? scheduledTime : waitText}
          {tripId && !canceled && (
            <span style={{ marginLeft: 4, fontSize: 11 }}>📍</span>
          )}
        </div>
      </div>
    </div>
  );
}
