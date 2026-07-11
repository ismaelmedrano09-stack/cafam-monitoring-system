const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth');
const controller = require('../controllers/auditController');

router.get('/', authenticate, authorize('administrador', 'calidad'), asyncHandler(controller.list));

module.exports = router;
