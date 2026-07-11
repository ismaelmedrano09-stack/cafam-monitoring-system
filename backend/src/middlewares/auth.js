const jwt = require('jsonwebtoken');
const env = require('../config/env');
const pool = require('../config/db');
const { fail } = require('../utils/apiResponse');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) return fail(res, 'Token requerido', 'No autorizado', 401);

    const payload = jwt.verify(token, env.jwtSecret);
    const [rows] = await pool.query(
      'SELECT id, name, email, role, status, totp_enabled FROM users WHERE id = ? LIMIT 1',
      [payload.id]
    );

    if (!rows.length || rows[0].status !== 'active') {
      return fail(res, 'Usuario no autorizado', 'Cuenta inactiva o inexistente', 401);
    }

    req.user = rows[0];
    return next();
  } catch (error) {
    return fail(res, 'Token inválido o expirado', error, 401);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 'Usuario no autenticado', 'No autorizado', 401);
    if (!roles.includes(req.user.role)) {
      return fail(res, 'Permiso insuficiente', 'Rol no autorizado', 403);
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
