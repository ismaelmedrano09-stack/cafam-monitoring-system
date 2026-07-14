const pool = require('../config/db');
const dns = require('dns');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { sendWhatsApp, alarmWhatsAppText, simulatedWhatsAppText } = require('./whatsappService');
const bot = require('./whatsappBot');

// Envía WhatsApp por el bot propio si está vinculado; si no, usa CallMeBot como respaldo.
async function sendWhatsAppSmart(phone, apikey, text) {
  if (bot.isConnected()) {
    try {
      return await bot.sendBotMessage(phone, text);
    } catch (err) {
      console.error('[wa-bot] fallo al enviar, probando CallMeBot:', err.message);
    }
  }
  return sendWhatsApp(phone, apikey, text);
}

dns.setDefaultResultOrder?.('ipv4first');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SERVERNAME } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: { servername: SMTP_SERVERNAME || SMTP_HOST },
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

// Envío por API HTTPS de Brevo (puerto 443, no bloqueado en Railway)
async function sendViaBrevo(to, subject, fullHtml) {
  const fromEmail = process.env.BREVO_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { email: fromEmail, name: process.env.BREVO_FROM_NAME || 'Cafam Telemetría' },
      to: [{ email: to }],
      subject,
      htmlContent: fullHtml
    },
    {
      headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
      timeout: 15000
    }
  );
  return { sent: true, provider: 'brevo' };
}

async function sendEmail(to, subject, html) {
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body>${html}</body></html>`;

  if (process.env.BREVO_API_KEY) {
    try {
      return await sendViaBrevo(to, subject, fullHtml);
    } catch (err) {
      const detail = err.response?.data?.message || err.message;
      console.error(`[email] Brevo falló (${detail}), intentando SMTP...`);
    }
  }

  const transporter = createTransport();
  if (!transporter) return { skipped: true, reason: 'SMTP no configurado' };
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html: fullHtml,
    encoding: 'utf-8'
  });
  return { sent: true, provider: 'smtp' };
}

function alarmEmailHtml(alarm, sensor, contact) {
  const levelLabel = { critica: 'CRÍTICA', advertencia: 'ADVERTENCIA', informativa: 'INFORMATIVA' }[alarm.level] || alarm.level;
  const color = { critica: '#be2e35', advertencia: '#b98105', informativa: '#1268ad' }[alarm.level] || '#1268ad';
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:${color};color:white;padding:16px 20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">⚠️ Alarma ${levelLabel} — Cafam Telemetría</h2>
      </div>
      <div style="border:1px solid #dce5ec;border-top:none;padding:20px;border-radius:0 0 8px 8px">
        <p>Estimado/a <strong>${contact.name}</strong>,</p>
        <p>Se ha generado una alarma en el sistema de monitoreo de Clínicas Cafam:</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">
          <tr style="background:#f4f8fb"><td style="padding:6px;font-weight:bold;width:140px">Sede</td><td style="padding:6px">${escapeHtml(sensor.site_name || 'Sin sede')}</td></tr>
          <tr><td style="padding:6px;font-weight:bold;width:140px">Sensor</td><td style="padding:6px">${escapeHtml(sensor.code)} — ${escapeHtml(sensor.name)}</td></tr>
          <tr style="background:#f4f8fb"><td style="padding:6px;font-weight:bold">Área</td><td style="padding:6px">${escapeHtml(sensor.area || '—')}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">Nivel</td><td style="padding:6px;color:${color};font-weight:bold">${levelLabel}</td></tr>
          <tr style="background:#f4f8fb"><td style="padding:6px;font-weight:bold">Descripción</td><td style="padding:6px">${escapeHtml(alarm.description)}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">Valores detectados</td><td style="padding:6px">${escapeHtml(alarm.detected_value || 'Sin lectura reciente')}</td></tr>
          <tr style="background:#f4f8fb"><td style="padding:6px;font-weight:bold">Rango permitido</td><td style="padding:6px">${escapeHtml(alarm.allowed_range || 'No configurado')}</td></tr>
          <tr><td style="padding:6px;font-weight:bold">Fecha/hora</td><td style="padding:6px">${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</td></tr>
        </table>
        <p>Ingrese al sistema para atender la alarma y registrar la acción correctiva.</p>
        <p style="color:#647382;font-size:12px">Este mensaje fue generado automáticamente por el sistema de telemetría Cafam.</p>
      </div>
    </div>`;
}

async function queueAlarmNotifications(alarmId, sensorId, level) {
  const [[alarm]] = await pool.query('SELECT * FROM alarms WHERE id = ?', [alarmId]).catch(() => [[null]]);
  const [[sensor]] = await pool.query(
    `SELECT s.*, st.name AS site_name, st.city AS site_city
     FROM sensors s
     LEFT JOIN sites st ON st.id = s.site_id
     WHERE s.id = ?`,
    [sensorId]
  ).catch(() => [[null]]);

  const [contacts] = await pool.query(
    `SELECT nc.*
     FROM notification_contacts nc
     JOIN sensors s ON s.id = ?
     WHERE nc.status = 'active'
       AND (nc.site_id IS NULL OR nc.site_id = s.site_id)
       AND JSON_CONTAINS(nc.levels, JSON_QUOTE(?))`,
    [sensorId, level]
  );

  for (const contact of contacts) {
    const channels = typeof contact.channels === 'string' ? JSON.parse(contact.channels) : (contact.channels || []);
    for (const channel of channels) {
      const destination = channel === 'email' ? contact.email : contact.phone;
      if (!destination) continue;

      let status = 'queued';
      let providerMessage = 'En cola';

      if (channel === 'email' && alarm && sensor) {
        try {
          const result = await sendEmail(
            destination,
            `[Cafam Telemetría] Alarma ${level}: ${sensor.code}`,
            alarmEmailHtml(alarm, sensor, contact)
          );
          status = result.skipped ? 'queued' : 'sent';
          providerMessage = result.skipped ? result.reason : `Enviado via ${result.provider || 'SMTP'}`;
        } catch (err) {
          status = 'failed';
          providerMessage = err.message;
        }
      }

      if (channel === 'whatsapp' && alarm && sensor) {
        try {
          const result = await sendWhatsAppSmart(contact.phone, contact.whatsapp_apikey, alarmWhatsAppText(alarm, sensor));
          status = result.skipped ? 'queued' : 'sent';
          providerMessage = result.skipped ? result.reason : `Enviado via WhatsApp (${result.provider || 'callmebot'})`;
        } catch (err) {
          status = 'failed';
          providerMessage = err.message;
        }
      }

      await pool.query(
        `INSERT INTO notification_logs (alarm_id, contact_id, channel, destination, status, provider_message)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [alarmId, contact.id, channel, destination, status, providerMessage]
      );
    }
  }
}

function confirmationEmailHtml(contact, siteName, token) {
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const confirmUrl = `${appUrl}/confirmar-alerta?token=${token}`;
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#0b4f8a;color:white;padding:16px 20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">Cafam Telemetría Clínica — Confirmación de registro</h2>
      </div>
      <div style="border:1px solid #dce5ec;border-top:none;padding:20px;border-radius:0 0 8px 8px">
        <p>Hola <strong>${escapeHtml(contact.name)}</strong>${contact.cargo ? ` — ${escapeHtml(contact.cargo)}` : ''},</p>
        <p>Has sido registrado como contacto de notificaciones de alarma${siteName ? ` para la sede <strong>${escapeHtml(siteName)}</strong>` : ' (todas las sedes)'}.</p>
        <p><strong>Recibirás alertas por los siguientes canales:</strong><br/>
        ${(contact.channels || []).join(', ') || '—'}</p>
        <p><strong>Niveles de alarma suscritos:</strong><br/>
        ${(contact.levels || []).map(l => ({ informativa: 'Informativa', advertencia: 'Advertencia', critica: 'Crítica' }[l] || l)).join(', ') || '—'}</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${confirmUrl}" style="background:#168a55;color:white;padding:12px 28px;border-radius:7px;text-decoration:none;font-weight:bold;display:inline-block">
            ✓ Confirmar mi suscripción
          </a>
        </div>
        <p style="color:#647382;font-size:12px">Si no solicitaste este registro, puedes ignorar este mensaje.<br/>
        Clínicas Cafam · Sistema de telemetría clínica</p>
      </div>
    </div>`;
}

function userRegistrationEmailHtml(user, token) {
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const confirmUrl = `${appUrl}/confirmar-registro?token=${token}`;
  const roleLabel = {
    regente_farmacia: 'Regente de farmacia',
    auxiliar_farmacia: 'Auxiliar de farmacia',
    calidad: 'Calidad',
    mantenimiento_biomedico: 'Mantenimiento biomédico',
    consulta_auditor: 'Consulta / auditor'
  }[user.role] || user.role;

  return `
    <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto">
      <div style="background:#0b4f8a;color:white;padding:18px 22px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">Cafam Monitoring — Confirmación de cuenta</h2>
      </div>
      <div style="border:1px solid #dce5ec;border-top:none;padding:22px;border-radius:0 0 8px 8px">
        <p>Hola <strong>${escapeHtml(user.name)}</strong>,</p>
        <p>Recibimos tu solicitud para crear una cuenta en el sistema de monitoreo clínico Cafam.</p>
        <table style="width:100%;border-collapse:collapse;margin:14px 0">
          <tr style="background:#f4f8fb"><td style="padding:8px;font-weight:bold;width:150px">Correo</td><td style="padding:8px">${escapeHtml(user.email)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Rol solicitado</td><td style="padding:8px">${escapeHtml(roleLabel)}</td></tr>
          <tr style="background:#f4f8fb"><td style="padding:8px;font-weight:bold">Estado</td><td style="padding:8px">Pendiente de confirmación</td></tr>
        </table>
        <div style="text-align:center;margin:26px 0">
          <a href="${confirmUrl}" style="background:#168a55;color:white;padding:13px 28px;border-radius:7px;text-decoration:none;font-weight:bold;display:inline-block">
            Confirmar mi cuenta
          </a>
        </div>
        <p style="color:#647382;font-size:12px;line-height:1.45">
          Si no solicitaste esta cuenta, puedes ignorar este mensaje. El enlace solo se puede usar una vez.<br/>
          Clínicas Cafam · Sistema de telemetría clínica
        </p>
      </div>
    </div>`;
}

function simulatedAlertHtml(contact, sim) {
  const levelLabel = { critica: 'CRÍTICA', advertencia: 'ADVERTENCIA', informativa: 'INFORMATIVA' }[sim.level] || sim.level;
  const color = { critica: '#be2e35', advertencia: '#b98105', informativa: '#1268ad' }[sim.level] || '#1268ad';
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:${color};color:white;padding:16px 20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">⚠️ ALERTA ${levelLabel} — Cafam Telemetría <span style="font-size:13px;background:rgba(0,0,0,.25);padding:3px 8px;border-radius:4px;margin-left:8px">SIMULACIÓN</span></h2>
      </div>
      <div style="border:1px solid #dce5ec;border-top:none;padding:20px;border-radius:0 0 8px 8px">
        <p>Estimado/a <strong>${escapeHtml(contact.name)}</strong>${contact.cargo ? ` — ${escapeHtml(contact.cargo)}` : ''},</p>
        <p>Se ha generado una alerta de prueba en el sistema de monitoreo de Clínicas Cafam:</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">
          <tr><td style="padding:8px;font-weight:bold;width:160px;background:#f4f8fb">Sede</td><td style="padding:8px">${escapeHtml(sim.site_name)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Sensor</td><td style="padding:8px">${escapeHtml(sim.sensor_code)} — ${escapeHtml(sim.sensor_name)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;background:#f4f8fb">Área monitoreada</td><td style="padding:8px;background:#f4f8fb">${escapeHtml(sim.area)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Nivel de alarma</td><td style="padding:8px;color:${color};font-weight:bold">${levelLabel}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;background:#f4f8fb">Temperatura detectada</td><td style="padding:8px;background:#f4f8fb">${sim.temperature} °C</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Humedad detectada</td><td style="padding:8px">${sim.humidity} % HR</td></tr>
          <tr><td style="padding:8px;font-weight:bold;background:#f4f8fb">Rango permitido</td><td style="padding:8px;background:#f4f8fb">Temp: ${sim.temp_min}–${sim.temp_max} °C · Humedad: ${sim.humidity_min}–${sim.humidity_max} % HR</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Descripción</td><td style="padding:8px">${escapeHtml(sim.description)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;background:#f4f8fb">Fecha y hora</td><td style="padding:8px;background:#f4f8fb">${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</td></tr>
        </table>
        <p style="border-left:3px solid ${color};padding-left:12px;margin:16px 0"><strong>Acción requerida:</strong> Ingrese al sistema de telemetría Cafam para atender la alarma y registrar la acción correctiva.</p>
        <p style="background:#fff4d8;border:1px solid #f2d080;border-radius:6px;padding:10px;font-size:13px;color:#775000">
          ⚠️ <strong>Este es un mensaje de simulación.</strong> No hay una alerta real activa en este momento. Este mensaje fue enviado desde el panel de administración para verificar que las notificaciones llegan correctamente.
        </p>
        <p style="color:#647382;font-size:12px;margin-top:16px">Clínicas Cafam · Sistema de telemetría clínica · Bogotá, Colombia</p>
      </div>
    </div>`;
}

async function sendConfirmationEmail(contact, siteName, token) {
  return sendEmail(
    contact.email,
    'Cafam Telemetría — Confirma tu registro de alertas',
    confirmationEmailHtml(contact, siteName, token)
  );
}

async function sendUserRegistrationEmail(user, token) {
  return sendEmail(
    user.email,
    'Cafam Monitoring — Confirma tu cuenta',
    userRegistrationEmailHtml(user, token)
  );
}

async function sendSimulatedAlert(contact, sim) {
  const results = {};
  const channels = typeof contact.channels === 'string' ? JSON.parse(contact.channels) : (contact.channels || ['email']);

  if (!channels.length || channels.includes('email')) {
    results.email = await sendEmail(
      contact.email,
      `[SIMULACIÓN] Alerta ${sim.level}: ${sim.sensor_code} — ${sim.site_name}`,
      simulatedAlertHtml(contact, sim)
    );
  }

  if (channels.includes('whatsapp')) {
    try {
      results.whatsapp = await sendWhatsAppSmart(contact.phone, contact.whatsapp_apikey, simulatedWhatsAppText(sim));
    } catch (err) {
      results.whatsapp = { failed: true, reason: err.message };
    }
  }

  return results.email || results.whatsapp || { skipped: true, reason: 'Sin canales configurados' };
}

module.exports = { queueAlarmNotifications, sendConfirmationEmail, sendUserRegistrationEmail, sendSimulatedAlert, sendEmail };
