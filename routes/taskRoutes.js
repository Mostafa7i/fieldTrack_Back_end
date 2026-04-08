const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createTask,
  getSupervisorTasks,
  getStudentTasks,
  updateTaskStatus,
  closeTask,
  deleteTask
} = require('../controllers/taskController');

// Supervisor routes
router.post('/', protect, authorize('supervisor'), createTask);
router.get('/supervisor', protect, authorize('supervisor'), getSupervisorTasks);
router.put('/:id/close', protect, authorize('supervisor'), closeTask);
router.delete('/:id', protect, authorize('supervisor'), deleteTask);

// Student routes
router.get('/student', protect, authorize('student'), getStudentTasks);
router.put('/:id/status', protect, authorize('student'), updateTaskStatus);

module.exports = router;
