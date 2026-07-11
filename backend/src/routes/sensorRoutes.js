const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth');
const controller = require('../controllers/sensorController');

router.get('/', authenticate, asyncHandler(controller.list));
router.get('/sparklines', authenticate, asyncHandler(controller.sparklines));
router.get('/:id', authenticate, asyncHandler(controller.detail));
router.post('/', authenticate, authorize('administrador', 'mantenimiento_biomedico'), asyncHandler(controller.create));
router.put('/:id', authenticate, authorize('administrador', 'mantenimiento_biomedico'), asyncHandler(controller.update));
router.patch('/:id/status', authenticate, authorize('administrador', 'mantenimiento_biomedico'), asyncHandler(controller.setStatus));

module.exports = router;
