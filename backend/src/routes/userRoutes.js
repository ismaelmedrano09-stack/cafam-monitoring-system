const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth');
const controller = require('../controllers/userController');

router.get('/', authenticate, authorize('administrador'), asyncHandler(controller.list));
router.post('/', authenticate, authorize('administrador'), asyncHandler(controller.create));
router.put('/:id', authenticate, authorize('administrador'), asyncHandler(controller.update));
router.patch('/:id/status', authenticate, authorize('administrador'), asyncHandler(controller.setStatus));

module.exports = router;
