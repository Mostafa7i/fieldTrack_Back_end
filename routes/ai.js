const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/auth');


router.get('/health', aiController.healthCheck);
router.post('/chat', protect, aiController.chatAssistant);
router.get('/evaluate/:applicationId', protect, authorize('company', 'admin'), aiController.evaluateApplicant);
router.get('/recommendations', protect, authorize('student'), aiController.recommendInternships);

module.exports = router;
