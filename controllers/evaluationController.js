const Evaluation = require('../models/Evaluation');
const Application = require('../models/Application');
const Notification = require('../models/Notification');

// @desc    Create evaluation
// @route   POST /api/evaluations
// @access  Private (company)
const createEvaluation = async (req, res, next) => {
  try {
    const { studentId, internshipId, applicationId, scores, comments, recommendation } = req.body;

    const evaluation = await Evaluation.create({
      student: studentId,
      company: req.user.id,
      internship: internshipId,
      application: applicationId,
      scores,
      comments,
      recommendation,
      isCompleted: true,
    });

    // Notify student
    await Notification.create({
      recipient: studentId,
      sender: req.user.id,
      type: 'evaluation_submitted',
      title: 'You Have Been Evaluated',
      message: 'The company has submitted your performance evaluation.',
      link: `/dashboard/student`,
      metadata: { evaluationId: evaluation._id },
    });

    res.status(201).json({ success: true, data: evaluation });
  } catch (error) {
    next(error);
  }
};

// @desc    Get evaluations
// @route   GET /api/evaluations
// @access  Private
const getEvaluations = async (req, res, next) => {
  try {
    let evaluations;
    if (req.user.role === 'student') {
      evaluations = await Evaluation.find({ student: req.user.id })
        .populate('company', 'name')
        .populate('internship', 'title');
    } else if (req.user.role === 'company') {
      evaluations = await Evaluation.find({ company: req.user.id })
        .populate('student', 'name email avatar')
        .populate('internship', 'title');
    } else {
      evaluations = await Evaluation.find()
        .populate('student', 'name email')
        .populate('company', 'name')
        .populate('internship', 'title');
    }
    res.status(200).json({ success: true, count: evaluations.length, data: evaluations });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single evaluation
// @route   GET /api/evaluations/:id
// @access  Private
const getEvaluation = async (req, res, next) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id)
      .populate('student', 'name email avatar')
      .populate('company', 'name')
      .populate('internship', 'title');
    if (!evaluation) return res.status(404).json({ success: false, message: 'Evaluation not found' });
    res.status(200).json({ success: true, data: evaluation });
  } catch (error) {
    next(error);
  }
};

// @desc    Get leaderboard (Top students by evaluation score)
// @route   GET /api/evaluations/leaderboard
// @access  Private
const getLeaderboard = async (req, res, next) => {
  try {
    const leaderboard = await Evaluation.aggregate([
      // Group by student to get their average score across all their evaluations
      {
        $group: {
          _id: '$student',
          averageScore: { $avg: '$totalScore' },
          evaluationsCount: { $sum: 1 },
        },
      },
      // Sort by average score descending
      { $sort: { averageScore: -1 } },
      // Limit to top 10
      { $limit: 10 },
      // Look up student details
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'studentInfo',
        },
      },
      { $unwind: '$studentInfo' },
      {
        $project: {
          _id: 1,
          averageScore: 1,
          evaluationsCount: 1,
          name: '$studentInfo.name',
          email: '$studentInfo.email',
          avatar: '$studentInfo.avatar',
        },
      },
    ]);

    res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    next(error);
  }
};

module.exports = { createEvaluation, getEvaluations, getEvaluation, getLeaderboard };
