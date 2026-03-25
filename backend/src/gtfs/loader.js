/**
 * loader.js
 * Scarica il feed GTFS statico GTT, estrae il ZIP,
 * e avvia l'importazione nel database.
 *
 * NOTA: L'URL del feed deve essere configurato in .env
 * (GTFS_STATIC_URL). Verificare l'URL aggiornato su
 * https://www.gtt.to.it/cms/percorari-e-tariffe/gtfs
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { importGtfs } = require('./parser');
const { isGtfsLoaded } = require('../db/database');

const DATA_DIR = path.resolve(
  process.env.GTFS_DATA_DIR || path.join(__dirname, '../../data/gtfs')
);
const ZIP_PATH = path.join(DATA_DIR, 'gtfs.zip');

// File GTFS obbligatori (il feed potrebbe non avere tutti gli opzionali)
const REQUIRED_FILES = [
  'stops.txt',
  'routes.txt',
  'trips.txt',
  'stop_times.txt',
];

/**
 * Scarica il file ZIP del feed GTFS.
 */
async function downloadGtfs(url) {
  console.log(`[Loader] Download GTFS da: ${url}`);

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120_000, // 2 minuti per feed grandi
    headers: {
      'User-Agent': 'GTT-WebApp/1.0 (open source transit app)',
    },
  });

  fs.writeFileSync(ZIP_PATH, response.data);
  console.log(
    `[Loader] ZIP scaricato: ${(response.data.byteLength / 1024 / 1024).toFixed(1)} MB`
  );
}

/**
 * Estrae i file CSV dal ZIP in memoria.
 * Non scrive su disco per velocità.
 * @returns {Object} mappa filename -> Buffer
 */
function extractGtfs() {
  console.log('[Loader] Estrazione ZIP...');

  const zip = new AdmZip(ZIP_PATH);
  const entries = zip.getEntries();
  const files = {};

  for (const entry of entries) {
    if (entry.entryName.endsWith('.txt')) {
      const name = path.basename(entry.entryName);
      files[name] = entry.getData(); // Buffer
    }
  }

  // Controlla i file obbligatori
  for (const required of REQUIRED_FILES) {
    if (!files[required]) {
      console.warn(`[Loader] ATTENZIONE: file obbligatorio mancante: ${required}`);
    }
  }

  console.log(`[Loader] Estratti ${Object.keys(files).length} file`);
  return files;
}

/**
 * Pipeline completa: download → estrazione → importazione DB.
 * @param {boolean} force - Forza anche se già caricato
 */
async function loadGtfs(force = false) {
  const url = process.env.GTFS_STATIC_URL;

  if (!url) {
    console.error(
      '[Loader] ERRORE: GTFS_STATIC_URL non configurato in .env\n' +
      '         Verificare URL su https://www.gtt.to.it/cms/percorari-e-tariffe/gtfs'
    );
    return false;
  }

  if (!force && isGtfsLoaded()) {
    console.log('[Loader] GTFS già caricato, skip. Usa force=true per forzare.');
    return true;
  }

  try {
    await downloadGtfs(url);
    const files = extractGtfs();
    importGtfs(files);

    // Pulizia ZIP dopo importazione (risparmia spazio disco)
    // fs.unlinkSync(ZIP_PATH);

    return true;
  } catch (err) {
    console.error('[Loader] Errore durante caricamento GTFS:', err.message);

    // Se il DB è già caricato con dati precedenti, possiamo continuare
    if (isGtfsLoaded()) {
      console.warn('[Loader] Uso dati GTFS precedenti (aggiornamento fallito)');
      return true;
    }

    return false;
  }
}

module.exports = { loadGtfs };

// Esecuzione diretta: node src/gtfs/loader.js
if (require.main === module) {
  require('../db/database').initSchema();
  loadGtfs(true).then(ok => {
    console.log(ok ? 'GTFS caricato con successo' : 'Caricamento fallito');
    process.exit(ok ? 0 : 1);
  });
}
