const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth');
const controller = require('../controllers/monitoringController');

router.get('/overview', authenticate, asyncHandler(controller.overview));
router.get('/sites', asyncHandler(controller.sites));
router.post('/sites', authenticate, authorize('administrador'), asyncHandler(controller.createSite));
router.put('/sites/:id', authenticate, authorize('administrador'), asyncHandler(controller.updateSite));
router.get('/contacts', authenticate, asyncHandler(controller.contacts));
router.post('/contacts', authenticate, authorize('administrador', 'calidad'), asyncHandler(controller.createContact));
router.post('/contacts/register', asyncHandler(controller.registerContact));
router.get('/contacts/confirm', asyncHandler(controller.confirmContact));
router.post('/simulate-alert', authenticate, authorize('administrador'), asyncHandler(controller.simulateAlert));
router.get('/files/sensor/:sensorId', authenticate, asyncHandler(controller.filesBySensor));
router.post('/files', authenticate, authorize('administrador', 'calidad', 'mantenimiento_biomedico'), asyncHandler(controller.createDeviceFile));
router.get('/extrema', authenticate, asyncHandler(controller.extrema));
router.get('/areas', authenticate, asyncHandler(controller.areas));

module.exports = router;
