const crypto = require('crypto');
const pool = require('../config/db');
const { ok, fail } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');
const { validateSite, validationError } = require('../utils/validation');
const { sendConfirmationEmail, sendSimulatedAlert } = require('../services/notificationService');

async function overview(req, res) {
  const [sites] = await pool.query(`
    SELECT st.*,
      COUNT(s.id) AS sensor_count,
      SUM(s.status = 'activo') AS active_sensors,
      SUM(s.status = 'desconectado') AS disconnected_sensors,
      SUM(EXISTS(
        SELECT 1 FROM alarms a
        WHERE a.sensor_id = s.id AND a.status IN ('abierta','en_atencion')
      )) AS sensors_in_alarm
    FROM sites st
    LEFT JOIN sensors s ON s.site_id = st.id
    GROUP BY st.id
    ORDER BY st.name
  `);

  const [devices] = await pool.query(`
    SELECT s.*, st.name AS site_name, st.code AS site_code,
      lr.temperature, lr.humidity, lr.calculated_status, lr.created_at AS last_reading_at,
      (SELECT COUNT(*) FROM alarms a
       WHERE a.sensor_id = s.id AND a.status IN ('abierta','en_atencion')) AS open_alarms
    FROM sensors s
    LEFT JOIN sites st ON st.id = s.site_id
    LEFT JOIN readings lr ON lr.id = (
      SELECT r.id FROM readings r WHERE r.sensor_id = s.id ORDER BY r.created_at DESC LIMIT 1
    )
    ORDER BY st.name, s.name
  `);

  const [alarmedVariables] = await pool.query(`
    SELECT a.id, a.level, a.description, a.status, a.started_at,
      s.code AS sensor_code, s.name AS sensor_name, st.name AS site_name
    FROM alarms a
    JOIN sensors s ON s.id = a.sensor_id
    LEFT JOIN sites st ON st.id = s.site_id
    WHERE a.status IN ('abierta','en_atencion')
    ORDER BY FIELD(a.level, 'critica','advertencia','informativa'), a.started_at DESC
    LIMIT 12
  `);

  const [notifications] = await pool.query(`
    SELECT nl.*, nc.name AS contact_name, a.level, s.code AS sensor_code
    FROM notification_logs nl
    JOIN notification_contacts nc ON nc.id = nl.contact_id
    JOIN alarms a ON a.id = nl.alarm_id
    JOIN sensors s ON s.id = a.sensor_id
    ORDER BY nl.created_at DESC LIMIT 12
  `);

  return ok(res, 'Centro de monitoreo consultado', {
    sites,
    devices,
    alarmedVariables,
    notifications
  });
}

async function contacts(req, res) {
  const [rows] = await pool.query(`
    SELECT nc.*, st.name AS site_name
    FROM notification_contacts nc
    LEFT JOIN sites st ON st.id = nc.site_id
    ORDER BY nc.status DESC, nc.name
  `);
  return ok(res, 'Contactos de notificación consultados', rows);
}

async function sites(req, res) {
  const [rows] = await pool.query(`
    SELECT st.*,
      COUNT(s.id) AS sensor_count,
      COUNT(CASE WHEN s.status = 'activo' THEN 1 END) AS active_sensors
    FROM sites st
    LEFT JOIN sensors s ON s.site_id = st.id
    GROUP BY st.id
    ORDER BY st.name
  `);
  return ok(res, 'Sedes consultadas', rows);
}

async function createSite(req, res) {
  const { code, name, address, city, latitude, longitude, status } = validateSite(req.body);
  const [result] = await pool.query(
    `INSERT INTO sites (code, name, address, city, latitude, longitude, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [code, name, address, city, latitude, longitude, status]
  );
  await logAudit({
    userId: req.user.id,
    action: 'create_site',
    entity: 'sites',
    entityId: result.insertId,
    description: `Sede creada: ${name}`,
    ipAddress: req.ip
  });
  return ok(res, 'Sede creada', { id: result.insertId }, 201);
}

async function updateSite(req, res) {
  const { code, name, address, city, latitude, longitude, status } = validateSite(req.body);
  const [result] = await pool.query(
    `UPDATE sites
     SET code = ?, name = ?, address = ?, city = ?, latitude = ?, longitude = ?, status = ?
     WHERE id = ?`,
    [code, name, address, city, latitude, longitude, status, req.params.id]
  );
  if (!result.affectedRows) throw validationError('La sede que intenta actualizar no existe.');
  await logAudit({
    userId: req.user.id,
    action: 'update_site',
    entity: 'sites',
    entityId: req.params.id,
    description: `Sede actualizada: ${name}`,
    ipAddress: req.ip
  });
  return ok(res, 'Sede actualizada');
}

async function createContact(req, res) {
  const { site_id = null, name, email = null, phone = null, channels = [], levels = [], status = 'active' } = req.body;
  const [result] = await pool.query(
    `INSERT INTO notification_contacts (site_id, name, email, phone, channels, levels, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [site_id, name, email, phone, JSON.stringify(channels), JSON.stringify(levels), status]
  );
  await logAudit({
    userId: req.user.id,
    action: 'create_notification_contact',
    entity: 'notification_contacts',
    entityId: result.insertId,
    description: `Contacto de alertas creado: ${name}`,
    ipAddress: req.ip
  });
  return ok(res, 'Contacto creado', { id: result.insertId }, 201);
}

async function filesBySensor(req, res) {
  const [rows] = await pool.query(`
    SELECT df.*, u.name AS uploaded_by_name
    FROM device_files df
    LEFT JOIN users u ON u.id = df.uploaded_by
    WHERE df.sensor_id = ?
    ORDER BY df.created_at DESC
  `, [req.params.sensorId]);
  return ok(res, 'Archivos del dispositivo consultados', rows);
}

async function createDeviceFile(req, res) {
  const { sensor_id, name, category = 'other', file_url = null, notes = null } = req.body;
  const [result] = await pool.query(
    `INSERT INTO device_files (sensor_id, name, category, file_url, notes, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sensor_id, name, category, file_url, notes, req.user.id]
  );
  await logAudit({
    userId: req.user.id,
    action: 'create_device_file',
    entity: 'device_files',
    entityId: result.insertId,
    description: `Documento asociado al sensor ${sensor_id}: ${name}`,
    ipAddress: req.ip
  });
  return ok(res, 'Archivo registrado', { id: result.insertId }, 201);
}

async function extrema(req, res) {
  const days = Math.min(Math.max(Number(req.query.days || 30), 1), 31);
  const [rows] = await pool.query(`
    SELECT s.id, s.code, s.name, st.name AS site_name,
      MIN(r.temperature) AS temp_min,
      MAX(r.temperature) AS temp_max,
      ROUND(AVG(r.temperature), 2) AS temp_avg,
      MIN(r.humidity) AS humidity_min,
      MAX(r.humidity) AS humidity_max,
      ROUND(AVG(r.humidity), 2) AS humidity_avg,
      ROUND(SUM(r.calculated_status = 'normal') / COUNT(*) * 100, 2) AS compliance,
      COUNT(*) AS reading_count
    FROM sensors s
    LEFT JOIN sites st ON st.id = s.site_id
    LEFT JOIN readings r ON r.sensor_id = s.id
      AND r.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY s.id
    ORDER BY st.name, s.name
  `, [days]);
  return ok(res, 'Reporte de máximos y mínimos', { days, rows });
}

async function areas(req, res) {
  const [areaRows] = await pool.query(`
    SELECT
      s.area,
      MIN(s.temp_min) AS temp_min,
      MAX(s.temp_max) AS temp_max,
      MIN(s.humidity_min) AS humidity_min,
      MAX(s.humidity_max) AS humidity_max,
      COUNT(DISTINCT CONCAT_WS('|', s.temp_min, s.temp_max, s.humidity_min, s.humidity_max)) AS threshold_config_count,
      COUNT(DISTINCT s.id) AS sensor_count,
      COUNT(DISTINCT CASE WHEN s.status = 'activo' THEN s.id END) AS active_sensors,
      COUNT(DISTINCT CASE WHEN EXISTS(
        SELECT 1 FROM alarms a
        WHERE a.sensor_id = s.id AND a.status IN ('abierta','en_atencion')
      ) THEN s.id END) AS sensors_in_alarm,
      MAX(r.created_at) AS last_reading_at
    FROM sensors s
    LEFT JOIN readings r ON r.sensor_id = s.id
    GROUP BY s.area
    ORDER BY s.area
  `);

  const [sensors] = await pool.query(`
    SELECT s.id, s.code, s.name, s.area, s.status,
      s.temp_min, s.temp_max, s.humidity_min, s.humidity_max,
      st.name AS site_name,
      lr.temperature, lr.humidity, lr.calculated_status,
      lr.created_at AS last_reading_at
    FROM sensors s
    LEFT JOIN sites st ON st.id = s.site_id
    LEFT JOIN readings lr ON lr.id = (
      SELECT r.id FROM readings r
      WHERE r.sensor_id = s.id
      ORDER BY r.created_at DESC LIMIT 1
    )
    ORDER BY s.area, s.name
  `);

  const [readings] = await pool.query(`
    SELECT r.id, r.sensor_id, s.code AS sensor_code, s.name AS sensor_name,
      s.area, r.temperature, r.humidity, r.calculated_status, r.created_at
    FROM readings r
    JOIN sensors s ON s.id = r.sensor_id
    WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ORDER BY r.created_at ASC
  `);

  const result = areaRows.map((area) => {
    const tempMin = Number(area.temp_min);
    const tempMax = Number(area.temp_max);
    const humidityMin = Number(area.humidity_min);
    const humidityMax = Number(area.humidity_max);
    const tempTolerance = (tempMax - tempMin) * 0.1;
    const humidityTolerance = (humidityMax - humidityMin) * 0.1;

    return {
      ...area,
      temp_min: tempMin,
      temp_max: tempMax,
      humidity_min: humidityMin,
      humidity_max: humidityMax,
      temp_warning_low: Number((tempMin + tempTolerance).toFixed(2)),
      temp_warning_high: Number((tempMax - tempTolerance).toFixed(2)),
      humidity_warning_low: Number((humidityMin + humidityTolerance).toFixed(2)),
      humidity_warning_high: Number((humidityMax - humidityTolerance).toFixed(2)),
      sensors: sensors.filter((sensor) => sensor.area === area.area),
      readings: readings.filter((reading) => reading.area === area.area)
    };
  });

  return ok(res, 'Áreas monitoreadas consultadas', result);
}

async function registerContact(req, res) {
  const { site_id = null, name, cargo = null, email, phone = null, channels = [], levels = [] } = req.body;
  if (!name || !email) return fail(res, 'Nombre y correo son obligatorios', null, 400);

  const normalizedEmail = String(email).trim().toLowerCase();
  const allowedLevels = ['critica', 'advertencia', 'informativa'];
  const allowedChannels = ['email', 'sms', 'call'];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return fail(res, 'Ingresa un correo electrónico válido', null, 400);
  if (!levels.length) return fail(res, 'Selecciona al menos un nivel de alarma', null, 400);
  if (!channels.length) return fail(res, 'Selecciona al menos un canal de notificación', null, 400);
  if (levels.some((level) => !allowedLevels.includes(level))) return fail(res, 'Uno de los niveles de alarma no es válido', null, 400);
  if (channels.some((channel) => !allowedChannels.includes(channel))) return fail(res, 'Uno de los canales de notificación no es válido', null, 400);
  if (channels.some((channel) => channel === 'sms' || channel === 'call') && !phone) {
    return fail(res, 'El teléfono es obligatorio para recibir SMS o llamadas', null, 400);
  }

  if (site_id) {
    const [[siteExists]] = await pool.query('SELECT id FROM sites WHERE id = ? AND status = ?', [site_id, 'active']);
    if (!siteExists) return fail(res, 'La sede seleccionada no existe o está inactiva', null, 400);
  }

  const [existing] = await pool.query('SELECT id, status FROM notification_contacts WHERE LOWER(email) = ?', [normalizedEmail]);
  if (existing[0]?.status === 'active') return fail(res, 'Este correo ya está registrado y confirmado para recibir alertas', null, 409);

  const token = crypto.randomBytes(32).toString('hex');
  let contactId;
  if (existing.length) {
    contactId = existing[0].id;
    await pool.query(
      `UPDATE notification_contacts
       SET site_id = ?, name = ?, cargo = ?, phone = ?, channels = ?, levels = ?, status = 'inactive', confirm_token = ?, confirmed_at = NULL
       WHERE id = ?`,
      [site_id, name, cargo, phone, JSON.stringify(channels), JSON.stringify(levels), token, contactId]
    );
  } else {
    const [result] = await pool.query(
      `INSERT INTO notification_contacts (site_id, name, cargo, email, phone, channels, levels, status, confirm_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'inactive', ?)`,
      [site_id, name, cargo, normalizedEmail, phone, JSON.stringify(channels), JSON.stringify(levels), token]
    );
    contactId = result.insertId;
  }

  const [[site]] = await pool.query('SELECT name FROM sites WHERE id = ?', [site_id || 0]).catch(() => [[null]]);
  const contact = { name, cargo, email: normalizedEmail, channels, levels };

  try {
    const result = await sendConfirmationEmail(contact, site?.name || null, token);
    if (result.skipped) {
      return ok(res, 'Registro guardado, pero el servidor de correo aún no está configurado. Solicita al administrador configurar SMTP y vuelve a intentarlo.', { id: contactId, email_sent: false }, 202);
    }
  } catch (err) {
    console.error('[email] Error al enviar confirmación:', err.message);
    return ok(res, 'Registro guardado, pero no fue posible enviar el correo de confirmación. Inténtalo nuevamente más tarde.', { id: contactId, email_sent: false }, 202);
  }

  return ok(res, 'Registro recibido. Revisa tu correo para confirmar la suscripción.', { id: contactId, email_sent: true });
}

async function confirmContact(req, res) {
  const { token } = req.query;
  if (!token) return fail(res, 'Token inválido', null, 400);
  const [rows] = await pool.query('SELECT id, name FROM notification_contacts WHERE confirm_token = ? LIMIT 1', [token]);
  if (!rows.length) return fail(res, 'El enlace de confirmación no es válido o ya fue usado', null, 404);
  await pool.query('UPDATE notification_contacts SET status = ?, confirmed_at = NOW(), confirm_token = NULL WHERE id = ?', ['active', rows[0].id]);
  return ok(res, `¡Confirmado! ${rows[0].name}, recibirás alertas correctamente.`);
}

async function simulateAlert(req, res) {
  const { contact_id, sensor_id, level = 'critica' } = req.body;
  if (!contact_id || !sensor_id) return fail(res, 'Debes seleccionar un contacto y un sensor', null, 400);
  if (!['critica', 'advertencia', 'informativa'].includes(level)) return fail(res, 'El nivel de alarma no es válido', null, 400);

  const [[contact]] = await pool.query("SELECT * FROM notification_contacts WHERE id = ? AND status = 'active'", [contact_id]);
  if (!contact || !contact.email) return fail(res, 'El contacto no existe, no tiene correo o aún no ha confirmado su suscripción', null, 404);
  const contactChannels = typeof contact.channels === 'string' ? JSON.parse(contact.channels) : (contact.channels || []);
  if (!contactChannels.includes('email')) return fail(res, 'El contacto no está suscrito al canal de correo electrónico', null, 400);

  const [[sensor]] = await pool.query(`
    SELECT s.*, st.name AS site_name, st.city AS site_city
    FROM sensors s LEFT JOIN sites st ON st.id = s.site_id WHERE s.id = ?`, [sensor_id]);
  if (!sensor) return fail(res, 'Sensor no encontrado', null, 404);

  const levelLabel = { critica: 'crítica', advertencia: 'advertencia', informativa: 'informativa' }[level] || 'critica';
  const temp = level === 'critica'
    ? (Number(sensor.temp_max) + 1.8).toFixed(1)
    : level === 'advertencia'
    ? (Number(sensor.temp_max) - 0.3).toFixed(1)
    : ((Number(sensor.temp_min) + Number(sensor.temp_max)) / 2).toFixed(1);
  const humidity = level === 'critica'
    ? (Number(sensor.humidity_max) + 5).toFixed(1)
    : (Number(sensor.humidity_max) - 2).toFixed(1);

  const sim = {
    site_name: sensor.site_name || 'Sin sede',
    site_city: sensor.site_city || 'Bogotá',
    sensor_code: sensor.code,
    sensor_name: sensor.name,
    area: sensor.area,
    level,
    temperature: temp,
    humidity,
    temp_min: sensor.temp_min,
    temp_max: sensor.temp_max,
    humidity_min: sensor.humidity_min,
    humidity_max: sensor.humidity_max,
    description: `${sensor.name} reporta valores ${level === 'critica' ? 'fuera del rango permitido' : 'cercanos al límite configurado'}`
  };

  const result = await sendSimulatedAlert(contact, sim);
  await logAudit({ userId: req.user.id, action: 'simulate_alert', entity: 'notification_contacts', entityId: contact_id, description: `Simulación de alerta ${level} enviada a ${contact.email}`, ipAddress: req.ip });

  if (result.skipped) return ok(res, 'Simulación registrada pero SMTP no está configurado. Configure SMTP_HOST en .env para enviar correos.', { skipped: true });
  return ok(res, `Alerta de simulación enviada a ${contact.email}`);
}

module.exports = { overview, sites, createSite, updateSite, contacts, createContact, registerContact, confirmContact, simulateAlert, filesBySensor, createDeviceFile, extrema, areas };
