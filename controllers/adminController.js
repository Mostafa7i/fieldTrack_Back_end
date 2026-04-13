const User = require('../models/User');
const Student = require('../models/Student');
const Company = require('../models/Company');
const Internship = require('../models/Internship');
const Application = require('../models/Application');
const TrainingReport = require('../models/TrainingReport');
const Attendance = require('../models/Attendance');
const Evaluation = require('../models/Evaluation');

// @desc    Admin analytics
// @route   GET /api/admin/analytics
// @access  Private (admin)
const getAnalytics = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalCompanies,
      totalSupervisors,
      totalInternships,
      openInternships,
      totalApplications,
      acceptedApplications,
      totalReports,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'company' }),
      User.countDocuments({ role: 'supervisor' }),
      Internship.countDocuments(),
      Internship.countDocuments({ status: 'open' }),
      Application.countDocuments(),
      Application.countDocuments({ status: 'accepted' }),
      TrainingReport.countDocuments(),
    ]);

    // Applications by status
    const applicationsByStatus = await Application.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Internships by category
    const internshipsByCategory = await Internship.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    // Recent registrations (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentRegistrations = await User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalUsers,
          totalStudents,
          totalCompanies,
          totalSupervisors,
          totalInternships,
          openInternships,
          totalApplications,
          acceptedApplications,
          totalReports,
          acceptanceRate: totalApplications ? Math.round((acceptedApplications / totalApplications) * 100) : 0,
        },
        applicationsByStatus,
        internshipsByCategory,
        recentRegistrations,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (admin)
const getAllUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20, search } = req.query;
    const query = {};
    if (role) query.role = role;
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(query);
    const users = await User.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));

    res.status(200).json({ success: true, count: users.length, total, data: users });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user active status
// @route   PUT /api/admin/users/:id/toggle
// @access  Private (admin)
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (admin)
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all companies with verification status
// @route   GET /api/admin/companies
// @access  Private (admin)
const getCompanies = async (req, res, next) => {
  try {
    const companies = await Company.find().populate('user', 'name email isActive createdAt').sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: companies.length, data: companies });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify company
// @route   PUT /api/admin/companies/:id/verify
// @access  Private (admin)
const verifyCompany = async (req, res, next) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, { isVerified: true }, { new: true });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.status(200).json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign supervisor to student
// @route   PUT /api/admin/students/:userId/assign-supervisor
// @access  Private (admin)
const assignSupervisor = async (req, res, next) => {
  try {
    const { supervisorId } = req.body;
    
    // Ensure the targeted user is a student
    const studentUser = await User.findById(req.params.userId);
    if (!studentUser || studentUser.role !== 'student') {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Ensure the assigned user is a supervisor
    const supervisorUser = await User.findById(supervisorId);
    if (!supervisorUser || supervisorUser.role !== 'supervisor') {
      return res.status(400).json({ success: false, message: 'Invalid supervisor ID' });
    }

    // Update the student profile
    const studentProfile = await Student.findOneAndUpdate(
      { user: req.params.userId },
      { supervisor: supervisorId },
      { new: true }
    );

    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    res.status(200).json({ success: true, message: 'Supervisor assigned successfully', data: studentProfile });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all internships (admin)
// @route   GET /api/admin/internships
// @access  Private (admin)
const getAllInternships = async (req, res, next) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Internship.countDocuments(query);
    const internships = await Internship.find(query)
      .populate('company', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    res.status(200).json({ success: true, count: internships.length, total, data: internships });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle internship status open/closed (admin)
// @route   PUT /api/admin/internships/:id/toggle
// @access  Private (admin)
const toggleInternshipStatus = async (req, res, next) => {
  try {
    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ success: false, message: 'Internship not found' });
    internship.status = internship.status === 'open' ? 'closed' : 'open';
    await internship.save({ validateBeforeSave: false });
    res.status(200).json({ success: true, data: internship });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all reports (admin)
// @route   GET /api/admin/reports
// @access  Private (admin)
const getAllReports = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const query = {};
    if (status) query.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await TrainingReport.countDocuments(query);
    const reports = await TrainingReport.find(query)
      .populate('student', 'name email')
      .populate('internship', 'title')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    res.status(200).json({ success: true, count: reports.length, total, data: reports });
  } catch (error) {
    next(error);
  }
};

// @desc    Get overall attendance summary (admin)
// @route   GET /api/admin/attendance
// @access  Private (admin)
const getAttendanceSummary = async (req, res, next) => {
  try {
    const summary = await Attendance.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalHours: { $sum: '$hoursWorked' } } },
    ]);
    const recent = await Attendance.find()
      .populate('student', 'name email')
      .populate('internship', 'title')
      .sort({ date: -1 })
      .limit(50);
    res.status(200).json({ success: true, data: { summary, recent } });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending verification users (company/supervisor)
// @route   GET /api/admin/pending
// @access  Private (admin)
const getPendingUsers = async (req, res, next) => {
  try {
    const users = await User.find({
      isVerified: false,
      isRejected: { $ne: true },
      role: { $in: ['company', 'supervisor'] },
    }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify (approve) a user account
// @route   PUT /api/admin/users/:id/verify
// @access  Private (admin)
const verifyUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isVerified = true;
    await user.save({ validateBeforeSave: false });
    res.status(200).json({ success: true, data: user, message: 'User verified and can now log in.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject user
// @route   PUT /api/admin/users/:id/reject
// @access  Private (Admin)
const rejectUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isRejected = true;
    user.isVerified = false; // Ensure they remain unverified
    await user.save({ validateBeforeSave: false });
    res.status(200).json({ success: true, data: user, message: 'User rejected.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAnalytics, getAllUsers, toggleUserStatus, deleteUser, getCompanies, verifyCompany, assignSupervisor, getAllInternships, toggleInternshipStatus, getAllReports, getAttendanceSummary, getPendingUsers, verifyUser, rejectUser };
