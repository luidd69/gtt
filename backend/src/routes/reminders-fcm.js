/**
 * reminders-fcm.js — Firebase Cloud Messaging reminders
 *
 * POST /api/reminders/fcm
 * Body: { fcmToken, title, body, fireAt }
 */

const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();

let firebaseInitError = null;

function hasInlineCredentials() {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

function isFirebaseConfigured() {
  return !!process.env.GOOGLE_APPLICATION_CREDENTIALS || hasInlineCredentials();
}

function initFirebase() {
  if (!isFirebaseConfigured()) {
    firebaseInitError =
      'Firebase non configurato: impostare GOOGLE_APPLICATION_CREDENTIALS oppure FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY';
    return false;
  }

  if (admin.apps.length > 0) {
    firebaseInitError = null;
    return true;
  }

  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    firebaseInitError = null;
    return true;
  } catch (err) {
    firebaseInitError = err.message;
    console.error('[FCM] Inizializzazione Firebase fallita:', err.message);
    return false;
  }
}

const scheduledFcmReminders = new Map();

async function sendReminder(reminder) {
  await admin.messaging().send({
    token: reminder.fcmToken,
    notification: {
      title: reminder.title,
      body: reminder.body,
    },
    data: {
      reminderId: reminder.id,
      fireAt: String(reminder.fireAt),
    },
    android: {
      priority: 'high',
    },
  });
}

setInterval(async () => {
  if (!initFirebase()) return;

  const now = Date.now();
  for (const [id, reminder] of scheduledFcmReminders) {
    if (reminder.fireAt > now) continue;

    scheduledFcmReminders.delete(id);
    try {
      await sendReminder(reminder);
    } catch (err) {
      console.error('[FCM] Invio reminder fallito:', id, err.message);
    }
  }
}, 15_000);

router.post('/', async (req, res) => {
  if (!initFirebase()) {
    return res.status(503).json({
      error: firebaseInitError || 'Firebase non configurato sul server',
    });
  }

  const { fcmToken, title, body, fireAt } = req.body || {};

  if (!fcmToken || !title || !body || !fireAt) {
    return res.status(400).json({
      error: 'Campi obbligatori: fcmToken, title, body, fireAt',
    });
  }

  const fireAtMs = Number(fireAt);
  if (!Number.isFinite(fireAtMs)) {
    return res.status(400).json({ error: 'fireAt deve essere un timestamp valido' });
  }
  if (fireAtMs <= Date.now()) {
    return res.status(400).json({ error: 'fireAt è già passato' });
  }

  const id = `fcm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  scheduledFcmReminders.set(id, {
    id,
    fcmToken,
    title,
    body,
    fireAt: fireAtMs,
  });

  return res.json({
    ok: true,
    id,
    scheduledCount: scheduledFcmReminders.size,
  });
});

module.exports = router;
