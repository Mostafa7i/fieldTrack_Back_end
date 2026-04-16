const express = require('express');
const router = express.Router();
const { logAttendance, autoLogAttendance, getAttendance, deleteAttendance, getShiftInfo } = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/shift-info', authorize('student'), getShiftInfo);
router.post('/auto', authorize('student'), autoLogAttendance);
router.post('/', authorize('student'), logAttendance);
router.get('/', getAttendance);
router.delete('/:id', authorize('student', 'admin'), deleteAttendance);

module.exports = router;
