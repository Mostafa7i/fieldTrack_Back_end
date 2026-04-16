const express = require('express');
const router = express.Router();
const {
  getInternships,
  getInternship,
  createInternship,
  updateInternship,
  deleteInternship,
  getMyInternships,
  toggleInternship,
} = require('../controllers/internshipController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getInternships);
router.get('/my', protect, authorize('company'), getMyInternships);
router.get('/:id', getInternship);
router.post('/', protect, authorize('company', 'admin'), createInternship);
router.put('/:id', protect, authorize('company', 'admin'), updateInternship);
router.put('/:id/toggle', protect, authorize('company', 'admin'), toggleInternship);
router.delete('/:id', protect, authorize('company', 'admin'), deleteInternship);

module.exports = router;
