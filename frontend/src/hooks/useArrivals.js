/**
 * useArrivals.js
 * Hook per i prossimi arrivi con auto-refresh.
 */

import { useQuery } from '@tanstack/react-query';
import { getArrivals } from '../utils/api';

/**
 * @param {string} stopId
 * @param {number} refreshInterval - secondi tra un refresh e l'altro (0 = disabilitato)
 */
export function useArrivals(stopId, refreshInterval = 30) {
  return useQuery({
    queryKey: ['arrivals', stopId],
    queryFn: () => getArrivals(stopId),
    enabled: !!stopId,
    refetchInterval: refreshInterval > 0 ? refreshInterval * 1000 : false,
    refetchIntervalInBackground: false,
    staleTime: 20_000,
  });
}
