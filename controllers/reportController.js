const TrainingReport = require('../models/TrainingReport');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Task = require('../models/Task');
const Evaluation = require('../models/Evaluation');
const User = require('../models/User');

// @desc    Submit training report
// @route   POST /api/reports
// @access  Private (student)
const submitReport = async (req, res, next) => {
  try {
    const { internshipId, weekNumber, title, content, tasksCompleted, challenges, learnings, hoursWorked } = req.body;

    const report = await TrainingReport.create({
      student: req.user.id,
      internship: internshipId,
      weekNumber,
      title,
      content,
      tasksCompleted,
      challenges,
      learnings,
      hoursWorked,
      status: 'submitted',
    });

    // Find student's supervisor and notify
    const studentProfile = await Student.findOne({ user: req.user.id });
    if (studentProfile && studentProfile.supervisor) {
      await Notification.create({
        recipient: studentProfile.supervisor,
        sender: req.user.id,
        type: 'report_submitted',
        title: 'New Training Report Submitted',
        message: `A student submitted Week ${weekNumber} report: "${title}"`,
        link: `/dashboard/supervisor`,
        metadata: { reportId: report._id },
      });
    }

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reports
// @route   GET /api/reports
// @access  Private
const getReports = async (req, res, next) => {
  try {
    let reports;
    if (req.user.role === 'student') {
      reports = await TrainingReport.find({ student: req.user.id })
        .populate('internship', 'title')
        .sort({ weekNumber: 1 });
    } else if (req.user.role === 'supervisor') {
      // Get all reports for students assigned to this supervisor
      const students = await Student.find({ supervisor: req.user.id }).select('user');
      const studentIds = students.map((s) => s.user);
      reports = await TrainingReport.find({ student: { $in: studentIds } })
        .populate('student', 'name email avatar')
        .populate('internship', 'title')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'admin') {
      reports = await TrainingReport.find()
        .populate('student', 'name email')
        .populate('internship', 'title')
        .sort({ createdAt: -1 })
        .limit(200);
    }
    res.status(200).json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single report
// @route   GET /api/reports/:id
// @access  Private
const getReport = async (req, res, next) => {
  try {
    const report = await TrainingReport.findById(req.params.id)
      .populate('student', 'name email avatar')
      .populate('internship', 'title')
      .populate('reviewedBy', 'name');
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

// @desc    Review / approve report (supervisor or admin)
// @route   PUT /api/reports/:id
// @access  Private (supervisor, admin)
const reviewReport = async (req, res, next) => {
  try {
    const { status, feedback, grade } = req.body;
    const report = await TrainingReport.findByIdAndUpdate(
      req.params.id,
      { status, feedback, grade, reviewedBy: req.user.id, reviewedAt: Date.now() },
      { new: true }
    ).populate('student', 'name');

    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    // Notify student
    await Notification.create({
      recipient: report.student,
      sender: req.user.id,
      type: 'report_reviewed',
      title: `Report ${status}`,
      message: `Your Week ${report.weekNumber} report has been ${status}`,
      link: `/dashboard/student`,
      metadata: { reportId: report._id },
    });

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate a comprehensive report for the supervisor's students (for PDF/admin submission)
// @route   GET /api/reports/supervisor-report
// @access  Private (supervisor)
const generateSupervisorReport = async (req, res, next) => {
  try {
    // Get all students under this supervisor
    const studentProfiles = await Student.find({ supervisor: req.user.id })
      .populate('user', 'name email avatar createdAt');

    const reportData = await Promise.all(
      studentProfiles.map(async (sp) => {
        const studentId = sp.user?._id;
        if (!studentId) return null;

        const [reports, attendance, tasks, evaluations] = await Promise.all([
          TrainingReport.find({ student: studentId })
            .populate('internship', 'title')
            .sort({ weekNumber: 1 }),
          Attendance.find({ student: studentId }).sort({ date: -1 }),
          Task.find({ student: studentId }),
          Evaluation.find({ student: studentId }),
        ]);

        // Attendance stats
        const totalDays = attendance.length;
        const presentDays = attendance.filter(a => a.status === 'present' || a.status === 'remote').length;
        const lateDays = attendance.filter(a => a.status === 'late').length;
        const absentDays = attendance.filter(a => a.status === 'absent').length;
        const totalHours = attendance.reduce((s, a) => s + (a.hoursWorked || 0), 0);
        const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

        // Report stats
        const approvedReports = reports.filter(r => r.status === 'approved');
        const avgGrade = approvedReports.length
          ? Math.round(approvedReports.reduce((s, r) => s + (r.grade || 0), 0) / approvedReports.length)
          : null;

        // Task stats
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const totalTasks = tasks.length;
        const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Evaluation stats
        const avgScore = evaluations.length
          ? (evaluations.reduce((s, e) => s + (e.totalScore || 0), 0) / evaluations.length).toFixed(1)
          : null;

        // Overall performance score (composite)
        const performanceScore = Math.round(
          (attendanceRate * 0.3) +
          ((avgGrade || 0) * 0.4) +
          (taskCompletionRate * 0.3)
        );

        return {
          student: {
            _id: sp.user._id,
            name: sp.user.name,
            email: sp.user.email,
            university: sp.university,
            major: sp.major,
            gpa: sp.gpa,
          },
          attendance: { totalDays, presentDays, lateDays, absentDays, totalHours: totalHours.toFixed(1), attendanceRate },
          reports: {
            total: reports.length,
            approved: approvedReports.length,
            submitted: reports.filter(r => r.status === 'submitted').length,
            avgGrade,
            list: reports.map(r => ({ weekNumber: r.weekNumber, title: r.title, status: r.status, grade: r.grade, internship: r.internship?.title })),
          },
          tasks: { total: totalTasks, completed: completedTasks, taskCompletionRate },
          evaluations: { count: evaluations.length, avgScore },
          performanceScore,
          supervisorNotes: '', // To be filled by supervisor in frontend
        };
      })
    );

    const validData = reportData.filter(Boolean);
    const supervisor = await User.findById(req.user.id).select('name email shiftStart shiftEnd');

    res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),
      supervisor: { name: supervisor.name, email: supervisor.email, shiftStart: supervisor.shiftStart, shiftEnd: supervisor.shiftEnd },
      totalStudents: validData.length,
      data: validData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get per-student progress summary (attendance + reports + tasks)
// @route   GET /api/reports/student-progress/:studentId
// @access  Private (supervisor)
const getStudentProgress = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    // Verify this student belongs to the requesting supervisor
    const sp = await Student.findOne({ user: studentId, supervisor: req.user.id });
    if (!sp) return res.status(403).json({ success: false, message: 'Access denied' });

    const [reports, attendance, tasks] = await Promise.all([
      TrainingReport.find({ student: studentId }).populate('internship', 'title').sort({ weekNumber: 1 }),
      Attendance.find({ student: studentId }).sort({ date: -1 }).limit(30),
      Task.find({ student: studentId }).sort({ createdAt: -1 }),
    ]);

    res.status(200).json({ success: true, data: { reports, attendance, tasks } });
  } catch (error) {
    next(error);
  }
};

module.exports = { submitReport, getReports, getReport, reviewReport, generateSupervisorReport, getStudentProgress };
