const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth');
const controller = require('../controllers/authController');

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, message: 'Demasiados intentos. Intente en 15 minutos.' }, standardHeaders: true, legacyHeaders: false });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { success: false, message: 'Demasiados registros desde esta conexión. Intente más tarde.' }, standardHeaders: true, legacyHeaders: false });
router.post('/login', loginLimiter, asyncHandler(controller.login));
router.post('/public-register', registerLimiter, asyncHandler(controller.publicRegister));
router.get('/confirm-registration', registerLimiter, asyncHandler(controller.confirmRegistration));
router.post('/register', authenticate, authorize('administrador'), asyncHandler(controller.register));
router.get('/me', authenticate, asyncHandler(controller.me));
router.post('/2fa/setup', authenticate, asyncHandler(controller.setupTotp));
router.post('/2fa/enable', authenticate, asyncHandler(controller.enableTotp));
router.post('/2fa/disable', authenticate, asyncHandler(controller.disableTotp));

module.exports = router;
