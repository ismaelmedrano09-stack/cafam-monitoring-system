const pool = require('../config/db');
const { ok, fail } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');

async function list(req, res) {
  const { status, level, sensorId, area, from, to, page, limit } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * pageSize;
  const params = [];
  const where = [];
  if (status) { where.push('a.status = ?'); params.push(status); }
  if (level) { where.push('a.level = ?'); params.push(level); }
  if (sensorId) { where.push('a.sensor_id = ?'); params.push(sensorId); }
  if (area) { where.push('s.area = ?'); params.push(area); }
  if (from) { where.push('a.started_at >= ?'); params.push(from); }
  if (to) { where.push('a.started_at <= ?'); params.push(to); }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM alarms a JOIN sensors s ON s.id = a.sensor_id ${whereClause}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT a.*, s.code AS sensor_code, s.name AS sensor_name, s.area,
       TIMESTAMPDIFF(MINUTE, a.started_at, COALESCE(a.closed_at, NOW())) AS age_minutes,
       CASE
         WHEN a.status IN ('abierta', 'en_atencion') AND a.level = 'critica'
           AND TIMESTAMPDIFF(MINUTE, a.started_at, NOW()) > 15 THEN 'vencida'
         WHEN a.status IN ('abierta', 'en_atencion') AND a.level = 'advertencia'
           AND TIMESTAMPDIFF(MINUTE, a.started_at, NOW()) > 60 THEN 'vencida'
         ELSE 'en_tiempo'
       END AS sla_status
     FROM alarms a JOIN sensors s ON s.id = a.sensor_id
     ${whereClause}
     ORDER BY a.started_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  return ok(res, 'Alarmas consultadas', rows, { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) });
}

async function detail(req, res) {
  const [[alarm]] = await pool.query(
    `SELECT a.*, s.code AS sensor_code, s.name AS sensor_name, s.area
     FROM alarms a JOIN sensors s ON s.id = a.sensor_id WHERE a.id = ?`,
    [req.params.id]
  );
  const [actions] = await pool.query('SELECT * FROM corrective_actions WHERE alarm_id = ? ORDER BY created_at DESC', [req.params.id]);
  return ok(res, 'Detalle de alarma', { alarm, actions });
}

async function attend(req, res) {
  await pool.query('UPDATE alarms SET status = ?, assigned_to = ? WHERE id = ?', ['en_atencion', req.body.assigned_to || req.user.name, req.params.id]);
  await logAudit({ userId: req.user.id, action: 'attend_alarm', entity: 'alarms', entityId: req.params.id, description: 'Alarma en atención', ipAddress: req.ip });
  return ok(res, 'Alarma marcada en atención');
}

async function close(req, res) {
  const [[action]] = await pool.query('SELECT id FROM corrective_actions WHERE alarm_id = ? LIMIT 1', [req.params.id]);
  if (!action) return fail(res, 'Debe registrar una acción correctiva antes de cerrar la alarma', 'Acción correctiva requerida', 400);
  await pool.query('UPDATE alarms SET status = ?, closed_at = NOW(), corrective_action_id = ? WHERE id = ?', ['cerrada', action.id, req.params.id]);
  await logAudit({ userId: req.user.id, action: 'close_alarm', entity: 'alarms', entityId: req.params.id, description: 'Alarma cerrada con acción correctiva', ipAddress: req.ip });
  return ok(res, 'Alarma cerrada');
}

module.exports = { list, detail, attend, close };
