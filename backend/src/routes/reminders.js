/**
 * reminders.js — Web Push reminders
 *
 * POST   /api/reminders            — salva reminder + push subscription
 * DELETE /api/reminders/:id        — cancella reminder
 * GET    /api/reminders/vapid-key  — ritorna la chiave pubblica VAPID
 */

const express = require('express');
const router = express.Router();
const webpush = require('web-push');

// ── VAPID ──────────────────────────────────────────────────────────────────

const vapidConfigured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT || 'mailto:admin@gtt.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
} else {
  console.warn('[Push] VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY mancanti — push notifiche disabilitate');
}

// ── Store in memoria: id → { id, subscription, title, body, tag, fireAt } ──

const reminders = new Map();

// ── Scheduler: ogni 15s invia le notifiche scadute ─────────────────────────

setInterval(async () => {
  if (!vapidConfigured) return;
  const now = Date.now();
  for (const [id, r] of reminders) {
    if (r.fireAt > now) continue;
    reminders.delete(id);
    try {
      await webpush.sendNotification(
        r.subscription,
        JSON.stringify({ title: r.title, body: r.body, tag: r.tag }),
      );
    } catch (err) {
      // 410 Gone = subscription scaduta, ignora
      if (err.statusCode !== 410) {
        console.error('[Push] Invio fallito:', id, err.statusCode ?? err.message);
      }
    }
  }
}, 15_000);

// ── Routes ─────────────────────────────────────────────────────────────────

// Chiave pubblica VAPID (frontend ne ha bisogno per subscribe)
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Salva un nuovo reminder
router.post('/', (req, res) => {
  if (!vapidConfigured) {
    return res.status(503).json({ error: 'Push notifiche non configurate sul server' });
  }
  const { id, subscription, title, body, tag, fireAt } = req.body;

  if (!id || !subscription || !title || !fireAt) {
    return res.status(400).json({ error: 'Campi obbligatori: id, subscription, title, fireAt' });
  }
  if (fireAt <= Date.now()) {
    return res.status(400).json({ error: 'fireAt è già passato' });
  }

  reminders.set(id, { id, subscription, title, body: body || '', tag: tag || 'gtt-reminder', fireAt });
  res.json({ ok: true, count: reminders.size });
});

// Cancella reminder
router.delete('/:id', (req, res) => {
  reminders.delete(req.params.id);
  res.json({ ok: true });
});

// Lista reminder attivi (debug / UI)
router.get('/', (req, res) => {
  const list = [...reminders.values()].map(r => ({
    id: r.id,
    title: r.title,
    body: r.body,
    tag: r.tag,
    fireAt: r.fireAt,
  }));
  res.json({ count: list.length, reminders: list });
});

module.exports = router;
