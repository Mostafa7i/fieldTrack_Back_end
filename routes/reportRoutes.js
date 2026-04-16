const express = require('express');
const router = express.Router();
const { submitReport, getReports, getReport, reviewReport, generateSupervisorReport, getStudentProgress } = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('student'), submitReport);
router.get('/', protect, getReports);
router.get('/supervisor-report', protect, authorize('supervisor'), generateSupervisorReport);
router.get('/student-progress/:studentId', protect, authorize('supervisor'), getStudentProgress);
router.get('/:id', protect, getReport);
router.put('/:id', protect, authorize('supervisor', 'admin'), reviewReport);

module.exports = router;

