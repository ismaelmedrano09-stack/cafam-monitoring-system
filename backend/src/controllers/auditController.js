const pool = require('../config/db');
const { ok } = require('../utils/apiResponse');

async function list(req, res) {
  const [rows] = await pool.query(`
    SELECT al.*, u.name AS user_name, u.email AS user_email
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.created_at DESC LIMIT 1000
  `);
  return ok(res, 'Auditoría consultada', rows);
}

module.exports = { list };
