const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { ok } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');

async function list(req, res) {
  const [rows] = await pool.query('SELECT id, name, email, role, status, created_at, updated_at FROM users ORDER BY name');
  return ok(res, 'Usuarios consultados', rows);
}

async function create(req, res) {
  const { name, email, password, role, status = 'active' } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
    [name, email, hash, role, status]
  );
  await logAudit({ userId: req.user.id, action: 'create_user', entity: 'users', entityId: result.insertId, description: `Usuario creado: ${email}`, ipAddress: req.ip });
  return ok(res, 'Usuario creado', { id: result.insertId }, 201);
}

async function update(req, res) {
  const { name, email, role, status, password } = req.body;
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET name = ?, email = ?, role = ?, status = ?, password_hash = ? WHERE id = ?', [name, email, role, status, hash, req.params.id]);
  } else {
    await pool.query('UPDATE users SET name = ?, email = ?, role = ?, status = ? WHERE id = ?', [name, email, role, status, req.params.id]);
  }
  await logAudit({ userId: req.user.id, action: 'update_user', entity: 'users', entityId: req.params.id, description: `Usuario actualizado: ${email}`, ipAddress: req.ip });
  return ok(res, 'Usuario actualizado');
}

async function setStatus(req, res) {
  await pool.query('UPDATE users SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  return ok(res, 'Estado de usuario actualizado');
}

module.exports = { list, create, update, setStatus };
