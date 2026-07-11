const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth');
const controller = require('../controllers/correctiveActionController');

router.get('/', authenticate, asyncHandler(controller.list));
router.post('/', authenticate, authorize('administrador', 'regente_farmacia', 'auxiliar_farmacia', 'mantenimiento_biomedico'), asyncHandler(controller.create));
router.get('/alarm/:alarmId', authenticate, asyncHandler(controller.byAlarm));

module.exports = router;
