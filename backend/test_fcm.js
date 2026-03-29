#!/usr/bin/env node
/**
 * Script di test FCM — invia una notifica push direttamente al dispositivo.
 * Uso: node test_fcm.js <FCM_TOKEN>
 *      node test_fcm.js  (usa il token da TOKEN env var oppure scopre dai log)
 */
const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'secrets', 'gitto-9684a-firebase-adminsdk-fbsvc-9a1329c0be.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
});

const token = process.argv[2] || process.env.FCM_TOKEN;

if (!token) {
  console.error('❌  Uso: node test_fcm.js <FCM_TOKEN>');
  console.error('   oppure: FCM_TOKEN=... node test_fcm.js');
  process.exit(1);
}

const message = {
  token,
  notification: {
    title: '✅ Test GTT — FCM OK',
    body: 'Notifica inviata via Firebase Cloud Messaging!',
  },
  android: {
    priority: 'high',
    notification: {
      channelId: 'gtt_reminders',
      priority: 'high',
      defaultSound: true,
      defaultVibrateTimings: true,
    },
  },
  data: {
    type: 'test',
    timestamp: Date.now().toString(),
  },
};

console.log('📤 Invio notifica FCM al token:', token.substring(0, 20) + '...');

admin.messaging().send(message)
  .then((response) => {
    console.log('✅ Notifica FCM inviata con successo!');
    console.log('   Message ID:', response);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Errore invio FCM:', error.message);
    if (error.code) console.error('   Code:', error.code);
    process.exit(1);
  });
