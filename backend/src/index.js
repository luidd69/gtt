/**
 * GTT Web App — Backend Server
 *
 * Stack: Node.js + Express + SQLite (better-sqlite3)
 * Dati: GTFS statico GTT + GTFS-RT (se disponibile)
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cron = require('node-cron');

const { initSchema, isGtfsLoaded } = require('./db/database');
const { loadGtfs } = require('./gtfs/loader');
const { clearAll: clearCache } = require('./utils/cache');

const stopsRouter = require('./routes/stops');
const linesRouter = require('./routes/lines');
const arrivalsRouter = require('./routes/arrivals');
const serviceRouter = require('./routes/service');
const journeyRouter = require('./routes/journey');
const tripsRouter = require('./routes/trips');

const PORT = parseInt(process.env.PORT) || 3001;
const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(helmet({
  crossOriginResourcePolicy: false,
}));

app.use(compression());

// CORS: consente chiamate dal frontend dev e prod
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permetti richieste senza origin (mobile, curl, Postman)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.length === 0 ||
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV === 'development'
    ) {
      return callback(null, true);
    }
    callback(new Error(`CORS: Origin ${origin} non autorizzata`));
  },
  methods: ['GET'],
}));

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/stops', stopsRouter);
app.use('/api/lines', linesRouter);
app.use('/api/arrivals', arrivalsRouter);
app.use('/api/service', serviceRouter);
app.use('/api/journey', journeyRouter);
app.use('/api/trips', tripsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    gtfsLoaded: isGtfsLoaded(),
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trovato' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Errore interno del server' });
});

// ─── Avvio ────────────────────────────────────────────────────────────────────

async function start() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   GTT Web App — Backend Server       ║');
  console.log('╚══════════════════════════════════════╝');

  // Inizializza schema DB
  initSchema();

  // Carica GTFS se non già presente
  if (!isGtfsLoaded()) {
    console.log('[Server] Prima esecuzione: caricamento dati GTFS...');
    const ok = await loadGtfs();
    if (!ok) {
      console.error(
        '[Server] ⚠️  Impossibile caricare GTFS.\n' +
        '         Verificare GTFS_STATIC_URL in .env\n' +
        '         Il server avvierà senza dati GTFS.'
      );
    }
  } else {
    console.log('[Server] Dati GTFS già presenti nel database');
  }

  // Aggiornamento automatico GTFS (cron)
  const cronExpr = process.env.GTFS_REFRESH_CRON || '0 3 * * *';
  cron.schedule(cronExpr, async () => {
    console.log('[CRON] Aggiornamento automatico GTFS...');
    clearCache();
    await loadGtfs(true);
    clearCache(); // svuota cache dopo ricaricamento
    console.log('[CRON] Aggiornamento completato');
  });

  console.log(`[Server] Aggiornamento GTFS programmato: ${cronExpr}`);

  app.listen(PORT, () => {
    console.log(`[Server] ✅ In ascolto su http://localhost:${PORT}`);
    console.log(`[Server] Ambiente: ${process.env.NODE_ENV || 'production'}`);
  });
}

start().catch(err => {
  console.error('[Server] Errore fatale:', err);
  process.exit(1);
});
