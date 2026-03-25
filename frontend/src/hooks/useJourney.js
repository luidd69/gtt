/**
 * useJourney.js
 * Hook React Query per la ricerca di corse tra due fermate.
 * Non ha refetchInterval: i risultati vengono richiesti solo su input utente.
 */

import { useQuery } from '@tanstack/react-query';
import { searchJourney } from '../utils/api';

/**
 * Hook per la ricerca corse tra due fermate.
 * @param {string} fromStopId
 * @param {string} toStopId
 * @param {boolean} enabled  - true solo quando l'utente ha cliccato "Cerca"
 * @param {object} options   - { arriveBy?: 'HH:MM', lookahead?: number }
 */
export function useJourney(fromStopId, toStopId, enabled = true, options = {}) {
  const { arriveBy, lookahead = 120 } = options;
  return useQuery({
    queryKey: ['journey', fromStopId, toStopId, arriveBy, lookahead],
    queryFn: () => searchJourney(fromStopId, toStopId, { lookahead, arriveBy }),
    enabled: enabled && !!fromStopId && !!toStopId,
    staleTime: 60_000,
    retry: 2,
  });
}
