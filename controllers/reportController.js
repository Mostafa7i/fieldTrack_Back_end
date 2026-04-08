const TrainingReport = require('../models/TrainingReport');
const Notification = require('../models/Notification');
const Student = require('../models/Student');

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

module.exports = { submitReport, getReports, getReport, reviewReport };
