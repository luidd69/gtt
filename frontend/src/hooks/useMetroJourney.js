/**
 * useMetroJourney.js
 * Hook React Query per la pianificazione di viaggi in metropolitana.
 * Si aggiorna automaticamente ogni 30s per riflettere i dati realtime.
 */

import { useQuery } from '@tanstack/react-query';
import { searchMetroJourney } from '../utils/api';

export function useMetroJourney(fromStopId, toStopId, enabled = true) {
  return useQuery({
    queryKey: ['metro-journey', fromStopId, toStopId],
    queryFn:  () => searchMetroJourney(fromStopId, toStopId),
    enabled:  enabled && !!fromStopId && !!toStopId,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}
