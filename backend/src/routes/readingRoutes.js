const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth');
const controller = require('../controllers/readingController');

router.get('/', authenticate, asyncHandler(controller.list));
router.get('/latest', authenticate, asyncHandler(controller.latest));
router.get('/sensor/:sensorId', authenticate, asyncHandler(controller.bySensor));
router.post('/manual', authenticate, authorize('administrador', 'regente_farmacia', 'auxiliar_farmacia'), asyncHandler(controller.manual));

module.exports = router;
