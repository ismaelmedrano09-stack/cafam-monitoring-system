// Envío de alertas por WhatsApp usando CallMeBot (https://www.callmebot.com).
// Cada destinatario debe activarse una vez enviando al bot (+34 644 71 81 99)
// el mensaje "I allow callmebot to send me messages" para obtener su API key.
const axios = require('axios');

const LEVEL_ICON = { critica: '🔴', advertencia: '🟡', informativa: '🔵' };
const LEVEL_LABEL = { critica: 'CRÍTICA', advertencia: 'ADVERTENCIA', informativa: 'INFORMATIVA' };

// phone en formato internacional (+521234567890), apikey personal de CallMeBot.
async function sendWhatsApp(phone, apikey, text) {
  if (!phone || !apikey) return { skipped: true, reason: 'WhatsApp sin activar (falta teléfono o API key)' };
  const cleanPhone = String(phone).replace(/[^\d+]/g, '');
  const { data } = await axios.get('https://api.callmebot.com/whatsapp.php', {
    params: { phone: cleanPhone, apikey, text },
    timeout: 20000
  });
  const body = String(data || '');
  if (/error|invalid/i.test(body) && !/queued|sent|delivered/i.test(body)) {
    throw new Error(`CallMeBot: ${body.replace(/<[^>]+>/g, ' ').trim().slice(0, 140)}`);
  }
  return { sent: true, provider: 'callmebot' };
}

function alarmWhatsAppText(alarm, sensor) {
  const icon = LEVEL_ICON[alarm.level] || '⚠️';
  const label = LEVEL_LABEL[alarm.level] || alarm.level;
  const when = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  return [
    `${icon} *Alarma ${label} — Cafam Telemetría*`,
    `${sensor?.code || ''} ${sensor?.name || ''}`.trim(),
    alarm.description || '',
    alarm.detected_value ? `Detectado: ${alarm.detected_value}` : null,
    alarm.allowed_range ? `Rango permitido: ${alarm.allowed_range}` : null,
    `${sensor?.site_name || 'Cafam'} · ${when}`,
    'Ingresa al sistema para atender la alarma.'
  ].filter(Boolean).join('\n');
}

function simulatedWhatsAppText(sim) {
  const icon = LEVEL_ICON[sim.level] || '⚠️';
  const label = LEVEL_LABEL[sim.level] || sim.level;
  const when = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  return [
    `${icon} *ALERTA ${label} — Cafam Telemetría* [SIMULACIÓN]`,
    `${sim.sensor_code} ${sim.sensor_name}`,
    `Temp: ${sim.temperature} °C · Humedad: ${sim.humidity} % HR`,
    `Rango: ${sim.temp_min}–${sim.temp_max} °C · ${sim.humidity_min}–${sim.humidity_max} % HR`,
    `${sim.site_name} · ${when}`,
    '⚠️ Mensaje de prueba, no hay alerta real.'
  ].join('\n');
}

module.exports = { sendWhatsApp, alarmWhatsAppText, simulatedWhatsAppText };
