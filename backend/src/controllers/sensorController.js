const pool = require('../config/db');
const { ok } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');
const { validateSensor, validationError } = require('../utils/validation');

async function list(req, res) {
  const [rows] = await pool.query(`
    SELECT s.*, st.name AS site_name, st.code AS site_code
    FROM sensors s LEFT JOIN sites st ON st.id = s.site_id
    ORDER BY st.name, s.area, s.name
  `);
  return ok(res, 'Sensores consultados', rows);
}

async function detail(req, res) {
  const [[sensor]] = await pool.query(`
    SELECT s.*, st.name AS site_name, st.address AS site_address, st.city AS site_city
    FROM sensors s LEFT JOIN sites st ON st.id = s.site_id
    WHERE s.id = ?
  `, [req.params.id]);
  if (!sensor) {
    const error = new Error('El sensor solicitado no existe.');
    error.status = 404;
    error.code = 'SENSOR_NOT_FOUND';
    throw error;
  }
  const [readings] = await pool.query('SELECT * FROM readings WHERE sensor_id = ? ORDER BY created_at DESC LIMIT 100', [req.params.id]);
  const [alarms] = await pool.query('SELECT * FROM alarms WHERE sensor_id = ? ORDER BY started_at DESC LIMIT 100', [req.params.id]);
  const [files] = await pool.query('SELECT * FROM device_files WHERE sensor_id = ? ORDER BY created_at DESC', [req.params.id]);
  return ok(res, 'Detalle de sensor', { sensor, readings, alarms, files });
}

async function create(req, res) {
  const payload = validateSensor(req.body);
  const fields = ['site_id', 'code', 'name', 'type', 'technology', 'firmware_version', 'battery_level', 'power_status', 'latitude', 'longitude', 'location', 'area', 'status', 'reading_frequency', 'temp_min', 'temp_max', 'humidity_min', 'humidity_max', 'installed_at', 'last_calibration_at', 'responsible', 'observations'];
  const values = fields.map((field) => payload[field] ?? null);
  const [result] = await pool.query(
    `INSERT INTO sensors (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
    values
  );
  await logAudit({ userId: req.user.id, action: 'create_sensor', entity: 'sensors', entityId: result.insertId, description: `Sensor creado: ${req.body.code}`, ipAddress: req.ip });
  return ok(res, 'Sensor creado', { id: result.insertId }, 201);
}

async function update(req, res) {
  const [[before]] = await pool.query('SELECT * FROM sensors WHERE id = ?', [req.params.id]);
  if (!before) throw validationError('El sensor que intenta actualizar no existe.');
  const payload = validateSensor(req.body);
  const fields = ['site_id', 'code', 'name', 'type', 'technology', 'firmware_version', 'battery_level', 'power_status', 'latitude', 'longitude', 'location', 'area', 'status', 'reading_frequency', 'temp_min', 'temp_max', 'humidity_min', 'humidity_max', 'installed_at', 'last_calibration_at', 'responsible', 'observations'];
  const assignments = fields.map((field) => `${field} = ?`).join(', ');
  const values = fields.map((field) => payload[field] ?? null);
  await pool.query(`UPDATE sensors SET ${assignments} WHERE id = ?`, [...values, req.params.id]);

  for (const field of ['temp_min', 'temp_max', 'humidity_min', 'humidity_max']) {
    if (String(before[field]) !== String(payload[field])) {
      await pool.query(
        `INSERT INTO threshold_changes (sensor_id, user_id, field_changed, old_value, new_value, justification)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.params.id, req.user.id, field, before[field], payload[field], req.body.justification || 'Actualización desde módulo de sensores']
      );
    }
  }

  await logAudit({ userId: req.user.id, action: 'update_sensor', entity: 'sensors', entityId: req.params.id, description: `Sensor actualizado: ${req.body.code}`, ipAddress: req.ip });
  return ok(res, 'Sensor actualizado');
}

async function setStatus(req, res) {
  if (!['activo', 'inactivo', 'mantenimiento', 'desconectado'].includes(req.body.status)) {
    throw validationError('El estado del sensor no es válido.');
  }
  await pool.query('UPDATE sensors SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  await logAudit({ userId: req.user.id, action: 'sensor_status', entity: 'sensors', entityId: req.params.id, description: `Estado cambiado a ${req.body.status}`, ipAddress: req.ip });
  return ok(res, 'Estado actualizado');
}

async function sparklines(req, res) {
  const [rows] = await pool.query(`
    SELECT r.sensor_id, r.temperature, r.humidity, r.calculated_status, r.created_at
    FROM readings r
    INNER JOIN (
      SELECT sensor_id, created_at
      FROM readings r2
      WHERE (SELECT COUNT(*) FROM readings r3 WHERE r3.sensor_id = r2.sensor_id AND r3.created_at >= r2.created_at) <= 10
    ) sub ON sub.sensor_id = r.sensor_id AND sub.created_at = r.created_at
    ORDER BY r.sensor_id, r.created_at ASC
  `);
  const map = {};
  for (const row of rows) {
    if (!map[row.sensor_id]) map[row.sensor_id] = [];
    map[row.sensor_id].push({ temperature: Number(row.temperature), humidity: Number(row.humidity), status: row.calculated_status });
  }
  return ok(res, 'Sparklines consultados', map);
}

module.exports = { list, detail, create, update, setStatus, sparklines };
