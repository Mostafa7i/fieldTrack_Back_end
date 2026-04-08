const mongoose = require('mongoose');

const TrainingReportSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    internship: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Internship',
      required: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
    },
    weekNumber: {
      type: Number,
      required: [true, 'Week number is required'],
      min: 1,
    },
    title: {
      type: String,
      required: [true, 'Report title is required'],
    },
    content: {
      type: String,
      required: [true, 'Report content is required'],
      maxlength: 5000,
    },
    tasksCompleted: [String],
    challenges: {
      type: String,
    },
    learnings: {
      type: String,
    },
    hoursWorked: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'reviewed', 'approved', 'rejected'],
      default: 'draft',
    },
    feedback: {
      type: String, // supervisor feedback
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    grade: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TrainingReport', TrainingReportSchema);
