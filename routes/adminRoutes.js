const express = require('express');
const router = express.Router();
const {
  getAnalytics,
  getAllUsers,
  toggleUserStatus,
  deleteUser,
  getCompanies,
  verifyCompany,
  assignSupervisor,
  getAllInternships,
  toggleInternshipStatus,
  getAllReports,
  getAttendanceSummary,
  getPendingUsers,
  verifyUser,
  rejectUser,
  getSupervisors,
  getStudentsWithSupervisors,
  updateSupervisorShift,
  removeSupervisor,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/analytics', getAnalytics);
router.get('/users', getAllUsers);
router.put('/users/:id/toggle', toggleUserStatus);
router.delete('/users/:id', deleteUser);
router.get('/companies', getCompanies);
router.put('/companies/:id/verify', verifyCompany);
router.put('/students/:userId/assign-supervisor', assignSupervisor);
router.put('/students/:userId/remove-supervisor', removeSupervisor);
router.get('/internships', getAllInternships);
router.put('/internships/:id/toggle', toggleInternshipStatus);
router.get('/reports', getAllReports);
router.get('/attendance', getAttendanceSummary);
router.get('/pending', getPendingUsers);
router.put('/users/:id/verify', verifyUser);
router.put('/users/:id/reject', rejectUser);

// Supervisor management routes
router.get('/supervisors', getSupervisors);
router.get('/students-supervisors', getStudentsWithSupervisors);
router.put('/supervisors/:id/shift', updateSupervisorShift);

module.exports = router;
