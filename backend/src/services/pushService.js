const webpush = require('web-push');
const pool = require('../config/db');

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_EMAIL || 'mailto:noreply@cafam.com.co',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

async function saveSubscription(userId, subscription) {
  const { endpoint, keys: { p256dh, auth } } = subscription;
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [userId || null, endpoint, p256dh, auth]
  );
}

async function removeSubscription(endpoint) {
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
}

async function sendPushToAll(payload) {
  if (!VAPID_PUBLIC_KEY) return;
  const [subs] = await pool.query('SELECT * FROM push_subscriptions');
  const dead = [];
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 60 }
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) dead.push(sub.endpoint);
    }
  }));
  if (dead.length) {
    await Promise.all(dead.map(ep => removeSubscription(ep)));
  }
}

async function sendAlarmPush(alarm, sensor) {
  const levelLabel = { critica: 'CRÍTICA', advertencia: 'ADVERTENCIA', informativa: 'INFORMATIVA' }[alarm.level] || alarm.level;
  const icon = { critica: '🔴', advertencia: '🟡', informativa: '🔵' }[alarm.level] || '⚠️';
  await sendPushToAll({
    type: 'alarm',
    title: `${icon} Alarma ${levelLabel} — ${sensor?.site_name || 'Cafam'}`,
    body: `${sensor?.name || sensor?.code}: ${alarm.description}`,
    level: alarm.level,
    sensor_code: sensor?.code,
    alarm_id: alarm.id,
    url: '/alarms'
  });
}

module.exports = { saveSubscription, removeSubscription, sendPushToAll, sendAlarmPush, VAPID_PUBLIC_KEY };
