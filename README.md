# GTT Torino — Web App

Web app mobile-first per consultare orari e prossimi passaggi della rete GTT di Torino.

## Architettura

```
gtt/
├── backend/          # Node.js + Express + SQLite
│   └── src/
│       ├── db/       # Schema e connessione SQLite
│       ├── gtfs/     # Loader e parser GTFS
│       ├── routes/   # API REST
│       └── utils/    # Cache, geo, time
└── frontend/         # React + Vite (mobile-first)
    └── src/
        ├── components/
        ├── hooks/
        ├── pages/
        ├── store/    # Zustand (preferiti)
        └── utils/
```

## Dati

- **GTFS Statico**: feed ufficiale GTT (fermate, linee, orari, calendario)
- **GTFS Realtime**: non disponibile pubblicamente (vedi sezione RT)

## Prerequisiti

- Node.js >= 18
- npm >= 9

## Avvio locale

### 1. Configura il backend

```bash
cd backend
cp .env.example .env
# Edita .env: imposta GTFS_STATIC_URL con l'URL del feed GTT
```

**Dove trovare l'URL GTFS GTT:**
- Visita https://www.gtt.to.it/cms/percorari-e-tariffe/gtfs
- Oppure: https://opendata.comune.torino.it (cerca "GTFS")
- L'URL punta a un file `.zip` contenente i CSV GTFS

### 2. Installa dipendenze e avvia il backend

```bash
cd backend
npm install
npm run dev
```

Al primo avvio, il server scarica automaticamente il feed GTFS e lo importa in SQLite.
**Il primo avvio può richiedere 5-15 minuti** a seconda della dimensione del feed.

Puoi anche fare il caricamento manuale:
```bash
npm run load-gtfs
```

### 3. Avvia il frontend

```bash
cd frontend
npm install
npm run dev
```

L'app sarà disponibile su http://localhost:5173

### 4. Apri l'app

Vai su http://localhost:5173 da browser desktop o mobile (sulla stessa rete).

## API Backend

| Endpoint | Descrizione |
|----------|-------------|
| `GET /api/stops/search?q=<query>` | Ricerca fermate |
| `GET /api/stops/nearby?lat=&lon=&radius=` | Fermate vicine |
| `GET /api/stops/:stopId` | Dettaglio fermata |
| `GET /api/lines` | Elenco linee |
| `GET /api/lines?type=1` | Solo metro (0=tram, 3=bus) |
| `GET /api/lines/:routeId` | Dettaglio linea |
| `GET /api/arrivals/:stopId` | Prossimi passaggi |
| `GET /api/service/status` | Stato servizio |
| `GET /api/service/metro` | Info metropolitana |
| `GET /api/service/gtfs-info` | Metadata GTFS caricato |
| `GET /api/health` | Health check |

## GTFS Realtime

**Stato attuale**: GTT non dispone di un feed GTFS-RT pubblicamente documentato.

Il codice è predisposto per integrarlo: basta impostare `GTFS_REALTIME_URL` in `.env`.
L'app distingue nettamente tra orari "programmati" e "realtime" in ogni schermata.

Per aggiornamenti sulle informazioni in tempo reale GTT:
- App ufficiale: **Muoversi a Torino**
- Sito: https://www.gtt.to.it

## Aggiornamento GTFS

Il backend aggiorna automaticamente il feed GTFS ogni notte (configurabile via `GTFS_REFRESH_CRON`).

Aggiornamento manuale:
```bash
cd backend && npm run load-gtfs
```

## Deploy

### Frontend (statico)

```bash
cd frontend
npm run build
# dist/ può essere servita da qualsiasi CDN/hosting statico
# (Netlify, Vercel, Cloudflare Pages, nginx, ecc.)
```

Imposta la variabile d'ambiente `VITE_API_URL` con l'URL del backend in produzione.

### Backend

Qualsiasi hosting Node.js: Railway, Render, VPS con PM2, Docker.

```bash
cd backend
NODE_ENV=production npm start
```

## Caratteristiche tecniche

- **SQLite + WAL mode**: ottimizzato per read-heavy workload
- **Cache in-memory** con TTL per categoria (30s arrivi, 5min fermate, 10min linee)
- **Batch insert** da 2000 righe per importazione GTFS veloce
- **Bounding box** pre-filtro per ricerca fermate vicine (O(1) vs O(n))
- **Service Worker** per PWA e cache offline parziale
- **React Query** per deduplicazione richieste e auto-refresh
- **Zustand + persist** per preferiti in localStorage
- **CSS custom properties** per dark mode automatico

## Limiti e punti critici

1. **GTFS-RT non disponibile**: gli orari sono programmati, non live
2. **Feed GTT irregolare**: l'URL può cambiare, va monitorato
3. **stop_times.txt grande**: l'import può richiedere minuti su hardware lento
4. **Nessun dato storico**: mostra solo i passaggi futuri del giorno corrente
5. **Corse notturne**: gestite (orari GTFS > 24:00), ma non sempre presenti nel feed
