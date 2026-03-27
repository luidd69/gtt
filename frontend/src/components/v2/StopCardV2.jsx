/**
 * StopCardV2.jsx (V2)
 * Card fermata con nome, codice, distanza e chip linee.
 */

import { Link } from 'react-router-dom';
import { formatStopName, extractStopCode } from '../../utils/formatters';
import RouteChip from './RouteChip';

export default function StopCardV2({ stop, routes, distance }) {
  const stopId   = stop.stop_id || stop.stopId;
  const rawName  = stop.stop_name || stop.stopName || '';
  const stopName = formatStopName(rawName) || rawName;
  const stopCode = stop.stop_code || stop.stopCode || extractStopCode(rawName);
  const distanceM = stop.distanceM ?? distance;

  const visible = routes?.slice(0, 5) ?? [];
  const extra   = (routes?.length ?? 0) - visible.length;

  return (
    <Link to={`/v2/stops/${stopId}`} className="v2-list-item" style={{ textDecoration: 'none' }}>
      {/* Icona */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: 'var(--v2-brand-tint)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }} aria-hidden="true">
        🚏
      </div>

      {/* Contenuto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="v2-fw-600 v2-truncate" style={{ fontSize: 15, color: 'var(--v2-text-1)' }}>
          {stopName}
        </div>
        <div className="v2-row v2-gap-xs" style={{ marginTop: 2, flexWrap: 'wrap' }}>
          {stopCode && (
            <span style={{ fontSize: 12, color: 'var(--v2-text-3)', marginRight: 4 }}>
              #{stopCode}
            </span>
          )}
          {distanceM !== undefined && (
            <span style={{ fontSize: 12, color: 'var(--v2-text-2)' }}>
              {distanceM < 1000 ? `${distanceM} m` : `${(distanceM / 1000).toFixed(1)} km`}
            </span>
          )}
        </div>
        {visible.length > 0 && (
          <div className="v2-row" style={{ gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
            {visible.map(r => (
              <RouteChip
                key={r.route_id || r.routeId}
                shortName={r.route_short_name || r.routeShortName}
                routeType={r.route_type ?? r.routeType}
                color={(r.route_color || r.routeColor) ? `#${(r.route_color || r.routeColor).replace(/^#/, '')}` : null}
                textColor={(r.route_text_color || r.routeTextColor) ? `#${(r.route_text_color || r.routeTextColor).replace(/^#/, '')}` : null}
                size="sm"
              />
            ))}
            {extra > 0 && (
              <span className="v2-chip bus" style={{ fontSize: 10 }}>+{extra}</span>
            )}
          </div>
        )}
      </div>

      {/* Chevron */}
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
        stroke="var(--v2-text-3)" strokeWidth="1.8" strokeLinecap="round">
        <path d="M1 1l5 5-5 5" />
      </svg>
    </Link>
  );
}
