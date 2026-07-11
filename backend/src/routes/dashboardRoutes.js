const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middlewares/auth');
const controller = require('../controllers/dashboardController');

router.get('/summary', authenticate, asyncHandler(controller.summary));
router.get('/charts', authenticate, asyncHandler(controller.charts));
router.get('/operations', authenticate, asyncHandler(controller.operations));

module.exports = router;
