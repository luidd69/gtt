/**
 * RouteChip.jsx (V2)
 * Chip numero linea con colori semantici per tipo.
 */

export default function RouteChip({ shortName, routeType, color, textColor, size = 'md' }) {
  const typeClass =
    routeType === 1 ? 'metro' :
    routeType === 0 ? 'tram'  : 'bus';

  const customStyle = color
    ? { backgroundColor: color, color: textColor || '#fff' }
    : null;

  const sizeStyle = size === 'lg'
    ? { fontSize: 14, padding: '4px 10px', minWidth: 32 }
    : size === 'sm'
    ? { fontSize: 10, padding: '2px 6px', minWidth: 20 }
    : {};

  return (
    <span
      className={`v2-chip ${customStyle ? 'custom' : typeClass}`}
      style={{ ...(customStyle ?? {}), ...sizeStyle }}
      aria-label={`Linea ${shortName}`}
    >
      {shortName}
    </span>
  );
}
