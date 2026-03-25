/**
 * TripTimeline.jsx
 * Timeline verticale delle fermate di una corsa.
 *
 * Visualizzazione:
 *   - Nodo verde  → fermata di partenza (isFrom)
 *   - Nodo rosso  → fermata di arrivo (isTo)
 *   - Nodo brand  → fermata corrente del veicolo (status=current)
 *   - Nodo grigio → fermata già percorsa (status=passed)
 *   - Nodo outline → fermata futura (status=upcoming)
 *
 * Le fermate precedenti alla fermata di partenza vengono collassate
 * se sono più di 1 (es: "... 5 fermate precedenti").
 *
 * Riusa le classi CSS .timeline-* definite in index.css.
 */

import { Link } from 'react-router-dom';
import { formatStopName } from '../utils/formatters';

/**
 * @param {Object}   props
 * @param {Array}    props.stops     - Array di fermate dalla response backend
 * @param {string}   [props.fromStopId] - stop_id fermata di partenza (per highlight)
 * @param {string}   [props.toStopId]   - stop_id fermata di arrivo (per highlight)
 */
export default function TripTimeline({ stops, fromStopId, toStopId }) {
  if (!stops?.length) return null;

  // Trova l'indice della fermata di partenza per collassare le precedenti
  const fromIdx = stops.findIndex(s => s.isFrom);

  // Collassa le fermate prima della partenza se più di 1
  let displayStops = stops;
  if (fromIdx > 1) {
    const leadingCount = fromIdx - 1;
    displayStops = [
      stops[0],
      { _collapsed: true, count: leadingCount, key: '_collapsed' },
      ...stops.slice(fromIdx),
    ];
  }

  return (
    <div className="timeline-container">
      {displayStops.map((stop, i) => {
        // Elemento collassato: mostra "N fermate precedenti"
        if (stop._collapsed) {
          return (
            <div key="collapsed" className="timeline-item status-passed" style={{ opacity: 0.5 }}>
              <div className="timeline-node status-passed" />
              <div style={{ paddingBottom: 12, fontSize: 13, color: 'var(--color-text-3)' }}>
                … {stop.count} {stop.count === 1 ? 'fermata precedente' : 'fermate precedenti'}
              </div>
            </div>
          );
        }

        // Determina la classe del nodo in base allo stato della fermata
        const nodeClass = stop.isFrom
          ? 'is-from'
          : stop.isTo
          ? 'is-to'
          : `status-${stop.status}`;

        const isHighlight = stop.isFrom || stop.isTo;
        const isPassed    = stop.status === 'passed' && !isHighlight;
        const isCurrent   = stop.status === 'current' && !isHighlight;

        // Classe CSS per la linea verticale di connessione
        const itemClass = [
          'timeline-item',
          isPassed  ? 'status-passed'  : '',
          isCurrent ? 'status-current' : '',
        ].filter(Boolean).join(' ');

        const stopName = formatStopName(stop.stopName) || stop.stopName;

        return (
          <div key={stop.stopId} className={itemClass}>
            <div className={`timeline-node ${nodeClass}`} />

            <div style={{ flex: 1, minWidth: 0, paddingBottom: 14 }}>
              <Link
                to={`/stops/${stop.stopId}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{
                  fontWeight: isHighlight || isCurrent ? 600 : 400,
                  fontSize: isHighlight ? 16 : 14,
                  color: isPassed ? 'var(--color-text-3)' : 'var(--color-text)',
                  lineHeight: 1.3,
                }}>
                  {stopName}
                </div>
              </Link>

              {/* Badge contestuale sotto il nome */}
              {stop.isFrom && (
                <span style={{
                  display: 'inline-block', marginTop: 3,
                  fontSize: 11, fontWeight: 600,
                  color: 'var(--color-success)',
                  background: 'rgba(48,209,88,0.12)',
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-pill)',
                }}>
                  Partenza
                </span>
              )}
              {stop.isTo && (
                <span style={{
                  display: 'inline-block', marginTop: 3,
                  fontSize: 11, fontWeight: 600,
                  color: 'var(--color-danger)',
                  background: 'rgba(255,59,48,0.12)',
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-pill)',
                }}>
                  Arrivo
                </span>
              )}
              {isCurrent && (
                <span style={{
                  display: 'inline-block', marginTop: 3,
                  fontSize: 11, fontWeight: 600,
                  color: 'var(--color-brand)',
                  background: 'var(--color-brand-light)',
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-pill)',
                }}>
                  ● Prossima fermata
                </span>
              )}
            </div>

            {/* Orario a destra */}
            <div style={{
              fontSize: isHighlight ? 16 : 13,
              fontWeight: isHighlight ? 700 : 400,
              fontVariantNumeric: 'tabular-nums',
              color: isPassed   ? 'var(--color-text-3)'
                   : isCurrent  ? 'var(--color-brand)'
                   : isHighlight ? 'var(--color-text)'
                   : 'var(--color-text-2)',
              flexShrink: 0,
              paddingTop: 2,
            }}>
              {stop.departureTime}
            </div>
          </div>
        );
      })}
    </div>
  );
}
