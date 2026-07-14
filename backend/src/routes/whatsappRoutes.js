const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth');
const bot = require('../services/whatsappBot');
const { ok, fail } = require('../utils/apiResponse');

// Estado del bot + QR de vinculación (solo administradores)
router.get('/status', authenticate, authorize('administrador'), asyncHandler(async (req, res) => {
  return ok(res, 'Estado del bot de WhatsApp', await bot.getStatus());
}));

// Inicia (o reinicia) el proceso de conexión para generar QR
router.post('/start', authenticate, authorize('administrador'), asyncHandler(async (req, res) => {
  await bot.startBot();
  return ok(res, 'Bot iniciándose. Consulta /status para obtener el QR.');
}));

// Mensaje de prueba
router.post('/test', authenticate, authorize('administrador'), asyncHandler(async (req, res) => {
  const { phone, text } = req.body;
  if (!phone) return fail(res, 'Indica el número de teléfono destino', null, 400);
  const result = await bot.sendBotMessage(phone, text || '✅ Prueba del bot de WhatsApp — Cafam Telemetría');
  return ok(res, 'Mensaje enviado', result);
}));

// Desvincular el número actual (borra la sesión)
router.post('/reset', authenticate, authorize('administrador'), asyncHandler(async (req, res) => {
  await bot.resetSession();
  return ok(res, 'Sesión eliminada. Usa /start y escanea el nuevo QR para vincular otro número.');
}));

module.exports = router;
