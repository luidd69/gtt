/**
 * favoritesStore.js
 * Store Zustand per fermate e linee preferite.
 * Persiste automaticamente in localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useFavoritesStore = create(
  persist(
    (set, get) => ({
      // { stopId: { stopId, stopCode, stopName } }
      stops: {},
      // { routeId: { routeId, routeShortName, routeLongName, routeType } }
      lines: {},
      // { key: { fromStop: {stopId,stopName}, toStop: {stopId,stopName}, label, usageCount } }
      // key = `${fromStopId}::${toStopId}`
      frequentRoutes: {},

      addStop: (stop) =>
        set((state) => ({
          stops: { ...state.stops, [stop.stopId || stop.stop_id]: {
            stopId: stop.stopId || stop.stop_id,
            stopCode: stop.stopCode || stop.stop_code,
            stopName: stop.stopName || stop.stop_name,
          }},
        })),

      removeStop: (stopId) =>
        set((state) => {
          const stops = { ...state.stops };
          delete stops[stopId];
          return { stops };
        }),

      isStopFavorite: (stopId) => !!get().stops[stopId],

      addLine: (route) =>
        set((state) => ({
          lines: { ...state.lines, [route.routeId || route.route_id]: {
            routeId: route.routeId || route.route_id,
            routeShortName: route.routeShortName || route.route_short_name,
            routeLongName: route.routeLongName || route.route_long_name,
            routeType: route.routeType || route.route_type,
            routeColor: route.routeColor || route.color,
          }},
        })),

      removeLine: (routeId) =>
        set((state) => {
          const lines = { ...state.lines };
          delete lines[routeId];
          return { lines };
        }),

      isLineFavorite: (routeId) => !!get().lines[routeId],

      // Percorsi frequenti: salva o incrementa contatore uso
      addFrequentRoute: (fromStop, toStop) => {
        const key = `${fromStop.stopId || fromStop.stop_id}::${toStop.stopId || toStop.stop_id}`;
        set((state) => {
          const existing = state.frequentRoutes[key];
          return {
            frequentRoutes: {
              ...state.frequentRoutes,
              [key]: {
                key,
                fromStop: {
                  stopId:   fromStop.stopId || fromStop.stop_id,
                  stopName: fromStop.stopName || fromStop.stop_name,
                  stopCode: fromStop.stopCode || fromStop.stop_code,
                },
                toStop: {
                  stopId:   toStop.stopId || toStop.stop_id,
                  stopName: toStop.stopName || toStop.stop_name,
                  stopCode: toStop.stopCode || toStop.stop_code,
                },
                usageCount: (existing?.usageCount || 0) + 1,
                lastUsed: Date.now(),
              },
            },
          };
        });
      },

      removeFrequentRoute: (key) =>
        set((state) => {
          const frequentRoutes = { ...state.frequentRoutes };
          delete frequentRoutes[key];
          return { frequentRoutes };
        }),

      // Restituisce i percorsi ordinati per uso più recente (max 5)
      getTopFrequentRoutes: () => {
        const routes = Object.values(get().frequentRoutes);
        return routes
          .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
          .slice(0, 5);
      },
    }),
    {
      name: 'gtt-favorites',
      version: 2, // bump per aggiungere frequentRoutes
      migrate: (state, version) => {
        if (version < 2) {
          return { ...state, frequentRoutes: {} };
        }
        return state;
      },
    }
  )
);

export default useFavoritesStore;
