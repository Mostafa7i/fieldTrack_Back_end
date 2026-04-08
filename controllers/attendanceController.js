const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Application = require('../models/Application');

// @desc    Student logs attendance
// @route   POST /api/attendance
// @access  Private (student)
const logAttendance = async (req, res, next) => {
  try {
    const { internshipId, date, checkIn, checkOut, status, notes, hoursWorked } = req.body;

    // Check student has accepted application for this internship
    const application = await Application.findOne({
      student: req.user.id,
      internship: internshipId,
      status: 'accepted',
    });
    if (!application) {
      return res.status(403).json({ success: false, message: 'You are not enrolled in this internship' });
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Upsert attendance for that day
    const attendance = await Attendance.findOneAndUpdate(
      { student: req.user.id, internship: internshipId, date: attendanceDate },
      { checkIn, checkOut, status, notes, hoursWorked: hoursWorked || 0 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Attendance already logged for this date' });
    }
    next(error);
  }
};

// @desc    Get attendance records
// @route   GET /api/attendance
// @access  Private (student gets own; supervisor gets assigned students; admin gets all)
const getAttendance = async (req, res, next) => {
  try {
    let records;
    const { internshipId, studentId, month, year } = req.query;

    const dateFilter = {};
    if (month && year) {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      dateFilter.date = { $gte: start, $lte: end };
    }

    if (req.user.role === 'student') {
      const query = { student: req.user.id, ...dateFilter };
      if (internshipId) query.internship = internshipId;
      records = await Attendance.find(query)
        .populate('internship', 'title')
        .sort({ date: -1 });
    } else if (req.user.role === 'supervisor') {
      const students = await Student.find({ supervisor: req.user.id }).select('user');
      const studentIds = students.map(s => s.user);
      const query = { student: { $in: studentIds }, ...dateFilter };
      if (studentId) query.student = studentId;
      if (internshipId) query.internship = internshipId;
      records = await Attendance.find(query)
        .populate('student', 'name email avatar')
        .populate('internship', 'title')
        .sort({ date: -1 });
    } else {
      const query = { ...dateFilter };
      if (studentId) query.student = studentId;
      if (internshipId) query.internship = internshipId;
      records = await Attendance.find(query)
        .populate('student', 'name email')
        .populate('internship', 'title')
        .sort({ date: -1 })
        .limit(500);
    }

    // Compute summary stats
    const total = records.length;
    const presentCount = records.filter(r => r.status === 'present').length;
    const lateCount = records.filter(r => r.status === 'late').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    const remoteCount = records.filter(r => r.status === 'remote').length;
    const totalHours = records.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);

    res.status(200).json({
      success: true,
      count: records.length,
      stats: { total, presentCount, lateCount, absentCount, remoteCount, totalHours },
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete attendance record
// @route   DELETE /api/attendance/:id
// @access  Private (student, admin)
const deleteAttendance = async (req, res, next) => {
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    if (req.user.role === 'student' && record.student.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await record.deleteOne();
    res.status(200).json({ success: true, message: 'Attendance record deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { logAttendance, getAttendance, deleteAttendance };
