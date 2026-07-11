const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const pool = require('../config/db');
const env = require('../config/env');
const { ok, fail } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');
const { sendUserRegistrationEmail } = require('../services/notificationService');

const PUBLIC_ROLES = new Set(['regente_farmacia', 'auxiliar_farmacia', 'calidad', 'mantenimiento_biomedico', 'consulta_auditor']);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validatePublicRegistration({ name, email, password, role }) {
  if (!String(name || '').trim()) return 'El nombre completo es obligatorio';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Ingresa un correo electrónico válido';
  if (!password || String(password).length < 8) return 'La contraseña debe tener mínimo 8 caracteres';
  if (role && !PUBLIC_ROLES.has(role)) return 'El rol seleccionado no está disponible para registro público';
  return null;
}

async function login(req, res) {
  const { email, password, totp_token } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);

  if (!rows.length) {
    await logAudit({ action: 'login_failed', entity: 'users', description: `Correo no encontrado: ${email}`, ipAddress: req.ip });
    return fail(res, 'Credenciales inválidas', 'Correo electrónico o contraseña incorrectos', 401);
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid || user.status !== 'active') {
    await logAudit({ userId: user.id, action: 'login_failed', entity: 'users', entityId: user.id, description: 'Credenciales inválidas o cuenta inactiva', ipAddress: req.ip });
    return fail(res, 'Credenciales inválidas', 'Correo electrónico o contraseña incorrectos', 401);
  }

  if (user.totp_enabled && user.totp_secret) {
    if (!totp_token) {
      return ok(res, 'Se requiere código 2FA', { requires_totp: true });
    }
    const verified = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token: totp_token, window: 1 });
    if (!verified) {
      await logAudit({ userId: user.id, action: 'login_failed_2fa', entity: 'users', entityId: user.id, description: 'Código 2FA inválido', ipAddress: req.ip });
      return fail(res, 'Código 2FA inválido', 'El código ingresado no es correcto o ya expiró', 401);
    }
  }

  const token = jwt.sign({ id: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  await logAudit({ userId: user.id, action: 'login_success', entity: 'users', entityId: user.id, description: 'Inicio de sesión exitoso', ipAddress: req.ip });
  return ok(res, 'Inicio de sesión exitoso', {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status }
  });
}

async function register(req, res) {
  const { name, email, password, role = 'consulta_auditor', status = 'active' } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
    [name, email, passwordHash, role, status]
  );
  await logAudit({ userId: req.user.id, action: 'create_user', entity: 'users', entityId: result.insertId, description: `Usuario creado: ${email}`, ipAddress: req.ip });
  return ok(res, 'Usuario creado', { id: result.insertId }, null, 201);
}

async function publicRegister(req, res) {
  const name = String(req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const role = PUBLIC_ROLES.has(req.body.role) ? req.body.role : 'consulta_auditor';
  const validationError = validatePublicRegistration({ name, email, password, role });
  if (validationError) return fail(res, validationError, null, 400);

  const [existing] = await pool.query('SELECT id, status FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing[0]?.status === 'active') {
    return fail(res, 'Este correo ya tiene una cuenta activa. Inicia sesión o solicita recuperación de acceso.', null, 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const confirmToken = crypto.randomBytes(32).toString('hex');
  let userId = existing[0]?.id;

  if (userId) {
    await pool.query(
      `UPDATE users
       SET name = ?, password_hash = ?, role = ?, status = 'inactive', confirmed_at = NULL, confirm_token = ?
       WHERE id = ?`,
      [name, passwordHash, role, confirmToken, userId]
    );
  } else {
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, status, confirm_token)
       VALUES (?, ?, ?, ?, 'inactive', ?)`,
      [name, email, passwordHash, role, confirmToken]
    );
    userId = result.insertId;
  }

  try {
    await sendUserRegistrationEmail({ name, email, role }, confirmToken);
  } catch (err) {
    console.error('[email] Error al enviar confirmación de cuenta:', err.message);
    return ok(res, 'Registro guardado, pero no fue posible enviar el correo de confirmación. Revisa la configuración SMTP e inténtalo nuevamente.', { id: userId, email_sent: false }, null, 202);
  }

  await logAudit({ action: 'public_user_registration', entity: 'users', entityId: userId, description: `Registro público pendiente: ${email}`, ipAddress: req.ip });
  return ok(res, 'Registro recibido. Revisa tu correo para confirmar la cuenta.', { id: userId, email_sent: true }, null, 201);
}

async function confirmRegistration(req, res) {
  const token = String(req.query.token || '').trim();
  if (!token) return fail(res, 'Token de confirmación requerido', null, 400);

  const [rows] = await pool.query('SELECT id, name, email FROM users WHERE confirm_token = ? LIMIT 1', [token]);
  if (!rows.length) return fail(res, 'El enlace de confirmación no es válido o ya fue usado', null, 404);

  const user = rows[0];
  await pool.query('UPDATE users SET status = ?, confirmed_at = NOW(), confirm_token = NULL WHERE id = ?', ['active', user.id]);
  await logAudit({ userId: user.id, action: 'confirm_user_registration', entity: 'users', entityId: user.id, description: `Cuenta confirmada: ${user.email}`, ipAddress: req.ip });
  return ok(res, `Cuenta confirmada correctamente. Ya puedes iniciar sesión, ${user.name}.`);
}

async function me(req, res) {
  return ok(res, 'Usuario autenticado', req.user);
}

async function setupTotp(req, res) {
  const secret = speakeasy.generateSecret({ name: `Cafam Telemetría (${req.user.email})`, length: 20 });
  await pool.query('UPDATE users SET totp_secret = ? WHERE id = ?', [secret.base32, req.user.id]);
  const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
  return ok(res, 'Secreto 2FA generado', { qr: qrDataUrl, secret: secret.base32 });
}

async function enableTotp(req, res) {
  const { token } = req.body;
  const [[user]] = await pool.query('SELECT totp_secret FROM users WHERE id = ?', [req.user.id]);
  if (!user?.totp_secret) return fail(res, 'Configure el 2FA primero', null, 400);
  const verified = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token, window: 1 });
  if (!verified) return fail(res, 'Código incorrecto', 'El código no coincide. Verifique la hora de su dispositivo.', 400);
  await pool.query('UPDATE users SET totp_enabled = 1 WHERE id = ?', [req.user.id]);
  await logAudit({ userId: req.user.id, action: 'enable_2fa', entity: 'users', entityId: req.user.id, description: '2FA activado', ipAddress: req.ip });
  return ok(res, '2FA activado correctamente');
}

async function disableTotp(req, res) {
  await pool.query('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?', [req.user.id]);
  await logAudit({ userId: req.user.id, action: 'disable_2fa', entity: 'users', entityId: req.user.id, description: '2FA desactivado', ipAddress: req.ip });
  return ok(res, '2FA desactivado');
}

module.exports = { login, register, publicRegister, confirmRegistration, me, setupTotp, enableTotp, disableTotp };
