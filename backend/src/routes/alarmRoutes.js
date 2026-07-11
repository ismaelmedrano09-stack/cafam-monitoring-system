const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth');
const controller = require('../controllers/alarmController');

router.get('/', authenticate, asyncHandler(controller.list));
router.get('/:id', authenticate, asyncHandler(controller.detail));
router.patch('/:id/attend', authenticate, authorize('administrador', 'regente_farmacia', 'auxiliar_farmacia', 'mantenimiento_biomedico'), asyncHandler(controller.attend));
router.patch('/:id/close', authenticate, authorize('administrador', 'regente_farmacia', 'mantenimiento_biomedico'), asyncHandler(controller.close));

module.exports = router;
