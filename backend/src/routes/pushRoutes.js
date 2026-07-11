const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middlewares/auth');
const { saveSubscription, removeSubscription, VAPID_PUBLIC_KEY } = require('../services/pushService');
const { ok } = require('../utils/apiResponse');

router.get('/vapid-public-key', (req, res) => {
  ok(res, 'VAPID key', { key: VAPID_PUBLIC_KEY || null });
});

router.post('/subscribe', authenticate, asyncHandler(async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ success: false, message: 'Suscripción inválida' });
  }
  await saveSubscription(req.user.id, subscription);
  return ok(res, 'Suscripción registrada');
}));

router.post('/unsubscribe', authenticate, asyncHandler(async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) await removeSubscription(endpoint);
  return ok(res, 'Suscripción eliminada');
}));

module.exports = router;
