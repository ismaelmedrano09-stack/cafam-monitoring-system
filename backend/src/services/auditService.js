const pool = require('../config/db');

async function logAudit({ userId = null, action, entity, entityId = null, description = '', ipAddress = null }) {
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, entity, entity_id, description, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, action, entity, entityId, description, ipAddress]
  );
}

module.exports = { logAudit };
