const pool = require('../config/db');
const { ok } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');

async function list(req, res) {
  const [rows] = await pool.query(`
    SELECT ca.*, u.name AS user_name, s.code AS sensor_code, s.name AS sensor_name
    FROM corrective_actions ca
    JOIN users u ON u.id = ca.user_id
    JOIN sensors s ON s.id = ca.sensor_id
    ORDER BY ca.created_at DESC LIMIT 500
  `);
  return ok(res, 'Acciones correctivas consultadas', rows);
}

async function create(req, res) {
  const { alarm_id, sensor_id, action_taken, evidence, observations, final_status } = req.body;
  const [result] = await pool.query(
    `INSERT INTO corrective_actions
     (alarm_id, sensor_id, user_id, action_taken, evidence, observations, final_status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [alarm_id, sensor_id, req.user.id, action_taken, evidence, observations, final_status]
  );
  await logAudit({ userId: req.user.id, action: 'create_corrective_action', entity: 'corrective_actions', entityId: result.insertId, description: action_taken, ipAddress: req.ip });
  return ok(res, 'Acción correctiva registrada', { id: result.insertId }, 201);
}

async function byAlarm(req, res) {
  const [rows] = await pool.query('SELECT * FROM corrective_actions WHERE alarm_id = ? ORDER BY created_at DESC', [req.params.alarmId]);
  return ok(res, 'Acciones por alarma', rows);
}

module.exports = { list, create, byAlarm };
