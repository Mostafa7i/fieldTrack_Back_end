const express = require('express');
const router = express.Router();
const { submitReport, getReports, getReport, reviewReport } = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('student'), submitReport);
router.get('/', protect, getReports);
router.get('/:id', protect, getReport);
router.put('/:id', protect, authorize('supervisor', 'admin'), reviewReport);

module.exports = router;
