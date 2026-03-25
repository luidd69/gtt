/**
 * useJourney.js
 * Hook React Query per la ricerca di corse tra due fermate.
 * Non ha refetchInterval: i risultati vengono richiesti solo su input utente.
 */

import { useQuery } from '@tanstack/react-query';
import { searchJourney } from '../utils/api';

export function useJourney(fromStopId, toStopId, enabled = true) {
  return useQuery({
    queryKey: ['journey', fromStopId, toStopId],
    queryFn: () => searchJourney(fromStopId, toStopId),
    enabled: enabled && !!fromStopId && !!toStopId,
    staleTime: 60_000,
    retry: 2,
  });
}
