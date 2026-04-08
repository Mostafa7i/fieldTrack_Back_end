const express = require('express');
const router = express.Router();
const {
  applyForInternship,
  getApplications,
  updateApplicationStatus,
  withdrawApplication,
} = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('student'), applyForInternship);
router.get('/', protect, getApplications);
router.put('/:id', protect, authorize('company', 'admin'), updateApplicationStatus);
router.delete('/:id', protect, authorize('student'), withdrawApplication);

module.exports = router;
