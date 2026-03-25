/**
 * StopCard.jsx
 * Card fermata cliccabile con nome, codice e linee servite.
 */

import { Link } from 'react-router-dom';
import { getRouteTypeInfo, formatStopName, extractStopCode } from '../utils/formatters';

function RouteChips({ routes, max = 5 }) {
  if (!routes?.length) return null;
  const visible = routes.slice(0, max);
  const extra = routes.length - max;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {visible.map(r => {
        const info = getRouteTypeInfo(r.route_type ?? r.routeType);
        const style = (r.route_color || r.routeColor)
          ? { backgroundColor: `#${r.route_color || r.routeColor}`, color: r.route_text_color ? `#${r.route_text_color}` : '#fff' }
          : null;
        return (
          <span
            key={r.route_id || r.routeId}
            className={`route-chip ${style ? 'custom' : info.cssClass}`}
            style={style ?? undefined}
          >
            {r.route_short_name || r.routeShortName}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="route-chip bus">+{extra}</span>
      )}
    </div>
  );
}

export default function StopCard({ stop, routes, distance }) {
  const stopId = stop.stop_id || stop.stopId;
  const rawName = stop.stop_name || stop.stopName || '';
  const stopName = formatStopName(rawName) || rawName;
  const stopCode = stop.stop_code || stop.stopCode || extractStopCode(rawName);
  const distanceM = stop.distanceM ?? distance;

  return (
    <Link to={`/stops/${stopId}`} className="list-item" style={{ textDecoration: 'none' }}>
      {/* Icona fermata */}
      <div className="stop-icon" aria-hidden="true">🚏</div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fw-600 truncate" style={{ fontSize: 16 }}>{stopName}</div>
        <div className="text-xs text-2" style={{ marginTop: 2 }}>
          {stopCode && <span style={{ marginRight: 8 }}>#{stopCode}</span>}
          {distanceM !== undefined && (
            <span>{distanceM < 1000 ? `${distanceM} m` : `${(distanceM/1000).toFixed(1)} km`}</span>
          )}
        </div>
        {routes && <RouteChips routes={routes} />}
      </div>

      {/* Chevron */}
      <svg className="chevron" width="8" height="14" viewBox="0 0 8 14" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M1 1l6 6-6 6"/>
      </svg>
    </Link>
  );
}
