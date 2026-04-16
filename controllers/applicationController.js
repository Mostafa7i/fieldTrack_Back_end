const Application = require('../models/Application');
const Internship = require('../models/Internship');
const Notification = require('../models/Notification');

// @desc    Student applies for internship
// @route   POST /api/applications
// @access  Private (student)
const applyForInternship = async (req, res, next) => {
  try {
    const { internshipId, coverLetter, resume } = req.body;

    const internship = await Internship.findById(internshipId);
    if (!internship) return res.status(404).json({ success: false, message: 'Internship not found' });
    if (internship.status !== 'open') return res.status(400).json({ success: false, message: 'Internship is closed' });

    const existing = await Application.findOne({ student: req.user.id, internship: internshipId });
    let application;

    if (existing) {
      if (existing.status !== 'withdrawn') {
        return res.status(400).json({ success: false, message: 'Already applied to this internship' });
      }
      
      // Reactivate withdrawn application
      existing.status = 'pending';
      if (coverLetter !== undefined) existing.coverLetter = coverLetter;
      if (resume !== undefined) existing.resume = resume;
      await existing.save();
      application = existing;
    } else {
      application = await Application.create({
        student: req.user.id,
        internship: internshipId,
        coverLetter,
        resume,
      });
    }

    // Increment application count
    await Internship.findByIdAndUpdate(internshipId, { $inc: { applicationsCount: 1 } });

    // Notify company
    await Notification.create({
      recipient: internship.company,
      sender: req.user.id,
      type: 'application_submitted',
      title: 'New Application Received',
      message: `A student has applied for "${internship.title}"`,
      link: `/dashboard/company`,
      metadata: { applicationId: application._id, internshipId },
    });

    const populated = await application.populate('internship', 'title company');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

const getApplications = async (req, res, next) => {
  try {
    let applications;
    const Student = require('../models/Student');
    if (req.user.role === 'student') {
      applications = await Application.find({ student: req.user.id })
        .populate('internship', 'title location type deadline status company companyProfile')
        .populate({ path: 'internship', populate: { path: 'companyProfile', select: 'companyName logo' } })
        .populate({ path: 'internship', populate: { path: 'company', select: 'name' } })
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'company') {
      const internships = await Internship.find({ company: req.user.id }).select('_id');
      const ids = internships.map((i) => i._id);
      let apps = await Application.find({ internship: { $in: ids } })
        .populate('student', 'name email avatar')
        .populate('internship', 'title')
        .sort({ createdAt: -1 })
        .lean();
        
      for (let app of apps) {
        if (app.student && app.student._id) {
          const profile = await Student.findOne({ user: app.student._id }).lean();
          if (profile) {
            app.student = { ...app.student, ...profile };
          }
        }
      }
      applications = apps;
    } else if (req.user.role === 'supervisor' || req.user.role === 'admin') {
      let apps = await Application.find()
        .populate('student', 'name email')
        .populate('internship', 'title company')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
        
      for (let app of apps) {
        if (app.student && app.student._id) {
          const profile = await Student.findOne({ user: app.student._id }).lean();
          if (profile) {
            app.student = { ...app.student, ...profile };
          }
        }
      }
      applications = apps;
    }
    res.status(200).json({ success: true, count: applications.length, data: applications });
  } catch (error) {
    next(error);
  }
};

const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const application = await Application.findById(req.params.id).populate('internship', 'title company');

    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    if (application.internship.company.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    application.status = status;
    application.notes = notes;
    application.reviewedAt = Date.now();
    application.reviewedBy = req.user.id;
    await application.save();

    // Notify student
    const type = status === 'accepted' ? 'application_accepted' : status === 'rejected' ? 'application_rejected' : 'application_reviewing';
    await Notification.create({
      recipient: application.student,
      sender: req.user.id,
      type,
      title: `Application ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `Your application for "${application.internship.title}" has been ${status}`,
      link: `/dashboard/student`,
      metadata: { applicationId: application._id },
    });

    res.status(200).json({ success: true, data: application });
  } catch (error) {
    next(error);
  }
};


const withdrawApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    if (application.student.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    application.status = 'withdrawn';
    await application.save();

    // Decrement application count
    await Internship.findByIdAndUpdate(application.internship, { $inc: { applicationsCount: -1 } });

    res.status(200).json({ success: true, message: 'Application withdrawn' });
  } catch (error) {
    next(error);
  }
};

module.exports = { applyForInternship, getApplications, updateApplicationStatus, withdrawApplication };
