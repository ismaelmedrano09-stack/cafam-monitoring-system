const pool = require('../config/db');
const { ok } = require('../utils/apiResponse');
const { createReading } = require('../services/readingService');

async function list(req, res) {
  const { sensorId, status, from, to } = req.query;
  const params = [];
  const where = [];
  if (sensorId) { where.push('r.sensor_id = ?'); params.push(sensorId); }
  if (status) { where.push('r.calculated_status = ?'); params.push(status); }
  if (from) { where.push('r.created_at >= ?'); params.push(from); }
  if (to) { where.push('r.created_at <= ?'); params.push(to); }
  const [rows] = await pool.query(
    `SELECT r.*, s.code AS sensor_code, s.name AS sensor_name, s.area
     FROM readings r JOIN sensors s ON s.id = r.sensor_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY r.created_at DESC LIMIT 500`,
    params
  );
  return ok(res, 'Lecturas consultadas', rows);
}

async function latest(req, res) {
  const [rows] = await pool.query(`
    SELECT r.*, s.code AS sensor_code, s.name AS sensor_name, s.area
    FROM readings r JOIN sensors s ON s.id = r.sensor_id
    ORDER BY r.created_at DESC LIMIT 20
  `);
  return ok(res, 'Últimas lecturas', rows);
}

async function bySensor(req, res) {
  const [rows] = await pool.query('SELECT * FROM readings WHERE sensor_id = ? ORDER BY created_at DESC LIMIT 500', [req.params.sensorId]);
  return ok(res, 'Lecturas del sensor', rows);
}

async function manual(req, res) {
  const reading = await createReading({ ...req.body, source: 'manual' });
  return ok(res, 'Lectura manual registrada', reading, 201);
}

module.exports = { list, latest, bySensor, manual };
