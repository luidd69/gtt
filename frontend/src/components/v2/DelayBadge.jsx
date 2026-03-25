/**
 * DelayBadge.jsx (V2)
 * Badge stato ritardo/orario con colori semantici.
 */

export default function DelayBadge({ delayMinutes, dataType, cancelled = false }) {
  if (cancelled) {
    return <span className="v2-badge cancelled">Cancellato</span>;
  }
  if (dataType !== 'realtime') {
    return <span className="v2-badge scheduled">Programmato</span>;
  }
  if (delayMinutes === null || delayMinutes === undefined) return null;
  if (delayMinutes === 0) {
    return <span className="v2-badge on-time">In orario</span>;
  }
  if (delayMinutes > 0 && delayMinutes <= 3) {
    return <span className="v2-badge mild">+{delayMinutes} min</span>;
  }
  if (delayMinutes > 3) {
    return <span className="v2-badge heavy">+{delayMinutes} min</span>;
  }
  // anticipo
  return <span className="v2-badge on-time">{delayMinutes} min</span>;
}
