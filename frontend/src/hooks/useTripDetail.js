/**
 * useTripDetail.js
 * Hook React Query per il dettaglio di una corsa con auto-refresh.
 * Stesso pattern di useArrivals (refresh ogni 30s, stop quando tab non è attivo).
 */

import { useQuery } from '@tanstack/react-query';
import { getTripDetail } from '../utils/api';

export function useTripDetail(tripId, fromStopId, toStopId, refreshInterval = 30) {
  return useQuery({
    queryKey: ['trip-detail', tripId, fromStopId, toStopId],
    queryFn: () => getTripDetail(tripId, fromStopId, toStopId),
    enabled: !!tripId,
    refetchInterval: refreshInterval > 0 ? refreshInterval * 1000 : false,
    refetchIntervalInBackground: false,
    staleTime: 20_000,
    retry: 2,
  });
}
