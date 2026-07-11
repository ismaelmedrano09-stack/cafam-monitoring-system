const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middlewares/auth');
const controller = require('../controllers/reportController');

router.get('/alarms/pdf', authenticate, asyncHandler((req, res) => controller.pdf({ ...req, params: { type: 'alarms' } }, res)));
router.get('/alarms/excel', authenticate, asyncHandler((req, res) => controller.excel({ ...req, params: { type: 'alarms' } }, res)));
router.get('/:type/pdf', authenticate, asyncHandler(controller.pdf));
router.get('/:type/excel', authenticate, asyncHandler(controller.excel));
router.get('/audit-dossier/pdf', authenticate, asyncHandler((req, res) => controller.pdf({ ...req, params: { type: 'audit-dossier' } }, res)));
router.get('/audit-dossier/excel', authenticate, asyncHandler((req, res) => controller.excel({ ...req, params: { type: 'audit-dossier' } }, res)));

module.exports = router;
