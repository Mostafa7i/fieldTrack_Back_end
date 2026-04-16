const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Application = require('../models/Application');
const User = require('../models/User');


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

// @desc    Auto log attendance via system time
// @route   POST /api/attendance/auto
// @access  Private (student)
const autoLogAttendance = async (req, res, next) => {
  try {
    const { internshipId, action } = req.body; // action: 'checkIn' | 'checkOut'

    const application = await Application.findOne({
      student: req.user.id,
      internship: internshipId,
      status: 'accepted',
    });
    if (!application) return res.status(403).json({ success: false, message: 'Not enrolled in this internship' });

    const now = new Date();
    const attendanceDate = new Date(now);
    attendanceDate.setHours(0, 0, 0, 0);

    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${hours}:${mins}`;

    let attendance = await Attendance.findOne({ student: req.user.id, internship: internshipId, date: attendanceDate });

    if (action === 'checkIn') {
      if (attendance && attendance.checkIn) {
        return res.status(400).json({ success: false, message: 'Already checked in today' });
      }
      
      // Determine late status dynamically based on supervisor's settings (default 10:00 AM)
      const studentProfile = await Student.findOne({ user: req.user.id }).populate('supervisor');
      let shiftStartVal = 10 * 60; // Default 10:00 AM
      
      if (studentProfile?.supervisor?.shiftStart) {
        const [h, m] = studentProfile.supervisor.shiftStart.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) shiftStartVal = h * 60 + m;
      }

      let status = 'present';
      const timeVal = now.getHours() * 60 + now.getMinutes();
      const gracePeriod = 15; // 15 mins
      
      if (timeVal > shiftStartVal + gracePeriod) {
        status = 'late';
      }

      attendance = await Attendance.create({
        student: req.user.id,
        internship: internshipId,
        date: attendanceDate,
        checkIn: currentTimeStr,
        status,
        notes: 'Auto-logged by system',
      });
      return res.status(200).json({ success: true, data: attendance });
    } 
    
    if (action === 'checkOut') {
      if (!attendance || !attendance.checkIn) {
        return res.status(400).json({ success: false, message: 'Must check in first' });
      }
      if (attendance.checkOut) {
        return res.status(400).json({ success: false, message: 'Already checked out today' });
      }

      // Calculate hours worked
      const [inH, inM] = attendance.checkIn.split(':').map(Number);
      const startTotalMinutes = inH * 60 + inM;
      const endTotalMinutes = now.getHours() * 60 + now.getMinutes();
      // Ensure positive hours
      const hoursWorked = Math.max(0, (endTotalMinutes - startTotalMinutes) / 60).toFixed(1);

      attendance.checkOut = currentTimeStr;
      attendance.hoursWorked = Number(hoursWorked);
      await attendance.save();

      return res.status(200).json({ success: true, data: attendance });
    }

    res.status(400).json({ success: false, message: 'Invalid action' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Attendance already logged for this date' });
    }
    next(error);
  }
};

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

// @desc    Get supervisor shift hours for current student
// @route   GET /api/attendance/shift-info
// @access  Private (student)
const getShiftInfo = async (req, res, next) => {
  try {
    const studentProfile = await Student.findOne({ user: req.user.id }).populate('supervisor', 'name shiftStart shiftEnd');
    
    if (!studentProfile || !studentProfile.supervisor) {
      // Return defaults if no supervisor assigned
      return res.status(200).json({
        success: true,
        data: {
          supervisorName: null,
          shiftStart: '09:00',
          shiftEnd: '17:00',
          hasSupervisor: false,
        },
      });
    }
    
    const sup = studentProfile.supervisor;
    res.status(200).json({
      success: true,
      data: {
        supervisorName: sup.name,
        shiftStart: sup.shiftStart || '09:00',
        shiftEnd: sup.shiftEnd || '17:00',
        hasSupervisor: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { logAttendance, autoLogAttendance, getAttendance, deleteAttendance, getShiftInfo };
