# Piano: Journey Planner con OTP (cambi inclusi)

## Obiettivo

Sostituire la ricerca "sole corse dirette" con un pianificatore reale che usa
OpenTripPlanner (OTP) di Muoversi a Torino, già integrato per gli arrivi.
Il risultato sarà simile a Google Maps: itinerari con cambi, tratti a piedi,
orari reali.

---

## Architettura

```
Frontend                  Backend                  OTP (esterno)
─────────                 ───────                  ─────────────
JourneyPlanner  ──────►  GET /api/journey/plan  ──►  plan.muoversiatorino.it
                          │                           /otp/routers/mato/index/graphql
                          │ (se OTP down)
                          └──► corse dirette GTFS (fallback)
```

---

## File da modificare

| File | Tipo modifica |
|------|--------------|
| `backend/src/gtfs/otp.js` | Aggiunta funzione `getOtpPlan()` |
| `backend/src/routes/journey.js` | Aggiunta route `GET /plan` |
| `frontend/src/utils/api.js` | Aggiunta `planJourney()` |
| `frontend/src/pages/JourneyPlanner.jsx` | Nuovi componenti itinerario + logica |

---

## Step 1 — `otp.js`: aggiungere `getOtpPlan()`

### Query GraphQL OTP1

```graphql
query OtpPlan(
  $from: InputCoordinates!,
  $to:   InputCoordinates!,
  $numItineraries: Int!,
  $date: String!,
  $time: String!,
  $arriveBy: Boolean!
) {
  plan(
    from: $from
    to:   $to
    numItineraries: $numItineraries
    date:      $date
    time:      $time
    arriveBy:  $arriveBy
    transportModes: [
      {mode: BUS}, {mode: TRAM}, {mode: SUBWAY}, {mode: WALK}
    ]
  ) {
    itineraries {
      duration
      startTime
      endTime
      waitingTime
      walkTime
      walkDistance
      legs {
        mode
        startTime
        endTime
        duration
        realTime
        distance
        from { name lat lon stop { gtfsId name } }
        to   { name lat lon stop { gtfsId name } }
        route { gtfsId shortName longName color textColor mode }
        trip  { gtfsId }
      }
    }
  }
}
```

### Funzione `getOtpPlan(fromLat, fromLon, toLat, toLon, options)`

- `options`: `{ numItineraries=5, date, time, arriveBy=false }`
- Se `date` non fornita: usa oggi in formato `YYYY-MM-DD`
- Se `time` non fornita: usa orario corrente `HH:MM:SS`
- `startTime`/`endTime` nei legs sono **ms Unix** → `new Date(ms)`
- Strip prefisso `gtt:` da `gtfsId` per `tripId` e `stopId`
- Ritorna `null` in caso di errore (OTP non raggiungibile)

### Formato itinerario normalizzato (output)

```js
{
  departureTime: "14:35",   // HH:MM
  arrivalTime:   "15:20",
  durationMin:   45,
  waitingMin:    3,
  walkMin:       5,
  walkDistanceM: 350,
  transfers:     1,         // transitLegs.length - 1
  legs: [
    {
      mode:        "BUS",   // WALK | BUS | TRAM | SUBWAY
      startTime:   "14:35",
      endTime:     "14:55",
      durationMin: 20,
      realTime:    false,
      distanceM:   0,
      from: { name: "Fermata A", stopId: "123" },
      to:   { name: "Fermata B", stopId: "456" },
      route: {
        shortName: "15",
        longName:  "...",
        color:     "#FF0000",   // null se non presente
        textColor: "#FFFFFF",
        type:      3,           // GTFS route_type
      },
      tripId: "trip_id_gtfs"
    },
    {
      mode:        "WALK",
      startTime:   "14:55",
      endTime:     "15:00",
      durationMin: 5,
      distanceM:   350,
      from: { name: "Fermata B", stopId: null },
      to:   { name: "Fermata C", stopId: null },
      route: null,
      tripId: null
    },
    { /* secondo mezzo */ }
  ],
  transitLegs: [ /* solo i legs != WALK */ ]
}
```

### Export

```js
module.exports = { getOtpArrivals, getOtpPlan, checkOtpHealth };
```

---

## Step 2 — `journey.js`: route `GET /plan`

```
GET /api/journey/plan?from=<stop_id>&to=<stop_id>[&arriveBy=HH:MM]
```

### Logica

1. Valida `from` e `to` (obbligatori, diversi)
2. SELECT fermata con `stop_lat, stop_lon` dal DB
3. Chiama `getOtpPlan(fromLat, fromLon, toLat, toLon, { ... })`
4. **Se OTP disponibile** → risposta con `source: 'otp'`
5. **Se OTP null (down)** → esegui query GTFS diretta (stessa logica di `/search`
   ma senza realtime e senza solutions) e costruisci itinerari single-leg
6. Risposta sempre con struttura `{ fromStop, toStop, itineraries, source, fallback, generatedAt }`

### Struttura risposta

```js
{
  fromStop:    { stopId, stopName, stopCode },
  toStop:      { stopId, stopName, stopCode },
  itineraries: [ /* array di itinerari normalizzati */ ],
  source:      "otp" | "gtfs_direct",
  fallback:    false | true,
  generatedAt: "2024-03-25T14:30:00.000Z"
}
```

### Import da aggiungere

```js
const { getOtpPlan } = require('../gtfs/otp');
```

---

## Step 3 — `api.js`: aggiungere `planJourney()`

```js
export const planJourney = (fromStopId, toStopId, { arriveBy } = {}) =>
  client.get('/journey/plan', {
    params: { from: fromStopId, to: toStopId, ...(arriveBy ? { arriveBy } : {}) }
  }).then(r => r.data);
```

---

## Step 4 — `JourneyPlanner.jsx`: nuova UI

### Modifiche alla logica

- Sostituire `useJourney` → `usePlan` (nuovo hook inline o nel file)
- `usePlan` chiama `planJourney`, stessa struttura di `useQuery`
- Il campo `data.itineraries` sostituisce `data.journeys`

### Nuovi componenti

#### `LegStrip` — visualizzazione compatta delle tratte

```
[🚌 15] ──── 5min a piedi ──── [🚊 4]
[🚌 18]   (diretto)
```

- Chip colorato per ogni leg transit (come `route-chip` esistente)
- Separatore testuale per leg WALK (`🚶 Xmin`)
- Stessa logica colori di `LineItem` e `JourneyCard` esistenti

#### `ItineraryCard` — card per ogni itinerario

```
┌────────────────────────────────────────────┐
│  14:35  ──►  15:20        45 min  1 cambio │
│  [🚌 15] ── 5min ── [🚊 4]                 │
│  (badge realtime se leg.realTime = true)   │
└────────────────────────────────────────────┘
```

Props: `{ itinerary, onClick }`

Click → naviga a `/journey/trip/<primo transitLeg tripId>?fromStop=...&toStop=...`
(per ora usa la prima tratta, in futuro si può aggiungere vista multi-leg)

### Stato fallback

Quando `data.fallback === true` mostrare un banner:

```
⚠️  Pianificatore non disponibile · corse dirette senza cambio
```

### Stato empty

```
🔍 Nessun itinerario trovato
"Nessuna corsa per arrivare prima delle HH:MM" (o "nei prossimi 120 min")
"Il pianificatore cerca tragitti con al massimo 1-2 cambi su linee GTT."
```

---

## Note tecniche

### Formato data OTP1
- `date`: `"YYYY-MM-DD"` (ISO 8601)
- `time`: `"HH:MM:SS"`
- `arriveBy`: `true` / `false`

### ms Unix nei legs OTP
```js
const d = new Date(leg.startTime);  // startTime è ms
const hhmm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
```

### Stop ID OTP → GTFS
```js
leg.trip?.gtfsId?.replace(/^gtt:/, '') || null
```

### Fallback GTFS single-leg
Ogni riga del fallback viene wrappata come itinerario con un solo leg transit:
```js
legs: [{
  mode:     row.route_type === 1 ? 'SUBWAY' : row.route_type === 0 ? 'TRAM' : 'BUS',
  startTime: depTime,
  endTime:   arrTime,
  // ...
}]
```

---

## Ordine di implementazione consigliato

1. `otp.js` → aggiungere `getOtpPlan` + helper functions + export
2. `journey.js` → aggiungere import + route `/plan`
3. Testare backend con `curl "localhost:3001/api/journey/plan?from=XXX&to=YYY"`
4. `api.js` → aggiungere `planJourney`
5. `JourneyPlanner.jsx` → `LegStrip`, `ItineraryCard`, logica `usePlan`

---

## Futuri miglioramenti (fuori scope ora)

- Vista dettaglio multi-leg (mostrare tutte le tratte, non solo la prima)
- Filtro "meno a piedi" / "meno cambi"
- Mappa del tragitto con polyline OTP
- Integrazione veicolo live su ogni tratta
