const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/auth');

// @route   POST /api/ai/chat
// @desc    Interact with the smart assistant
// @access  Private (All Roles)
router.post('/chat', protect, aiController.chatAssistant);

// @route   GET /api/ai/evaluate/:applicationId
// @desc    Evaluate a specific student's application using AI
// @access  Private (Company, Admin)
router.get('/evaluate/:applicationId', protect, authorize('company', 'admin'), aiController.evaluateApplicant);

// @route   GET /api/ai/recommendations
// @desc    Get AI-based internship recommendations for a student
// @access  Private (Student)
router.get('/recommendations', protect, authorize('student'), aiController.recommendInternships);

module.exports = router;
