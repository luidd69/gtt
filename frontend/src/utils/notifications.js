/**
 * notifications.js — Sistema Web Push GTT
 *
 * I reminder vengono inviati al backend che li manda tramite Web Push
 * al Service Worker, che li mostra anche con l'app chiusa.
 *
 * localStorage è usato solo per mostrare i reminder nell'UI.
 */

const UI_STORAGE_KEY = 'gtt-reminders-ui';

// ── UI Store (localStorage) ────────────────────────────────────────────────

export function getUiReminders() {
  try { return JSON.parse(localStorage.getItem(UI_STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveUiReminder(r) {
  const all = getUiReminders().filter(x => x.fireAt > Date.now());
  all.push(r);
  localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(all));
}

function removeUiReminder(id) {
  const all = getUiReminders().filter(x => x.id !== id);
  localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(all));
}

export function pruneUiReminders() {
  const now = Date.now();
  const valid = getUiReminders().filter(x => x.fireAt > now);
  localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(valid));
  return valid;
}

// ── VAPID / Subscription ───────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

let _vapidPublicKey = null;

async function getVapidKey() {
  if (_vapidPublicKey) return _vapidPublicKey;
  const res = await fetch('/api/reminders/vapid-key');
  if (!res.ok) throw new Error(`VAPID key non disponibile: ${res.status}`);
  const { publicKey } = await res.json();
  if (!publicKey) throw new Error('VAPID key mancante nella risposta');
  _vapidPublicKey = publicKey;
  return publicKey;
}

async function getPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const vapidKey = await getVapidKey();
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }
  return sub;
}

// ── Permessi ───────────────────────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// ── Schedula reminder via backend (sopravvive alla chiusura dell'app) ──────

export async function scheduleReminder({ id, title, body, tag, fireAt }) {
  // 1. Ottieni subscription push
  const sub = await getPushSubscription();
  if (!sub) throw new Error('Push non supportato');

  // 2. Invia al backend
  const res = await fetch('/api/reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, subscription: sub.toJSON(), title, body, tag, fireAt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Errore backend');
  }

  // 3. Salva in localStorage per mostrarlo nell'UI
  saveUiReminder({ id, title, body, tag, fireAt });
}

export async function cancelReminder(id) {
  try {
    const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE fallito: ${res.status}`);
  } catch (err) {
    console.error('[Reminder] Cancellazione backend fallita:', err);
    return false;
  }
  removeUiReminder(id);
  return true;
}

// bootstrapReminders non serve più con Web Push (il backend gestisce tutto),
// ma la esportiamo vuota per compatibilità con App.jsx
export function bootstrapReminders() {}
