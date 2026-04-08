const mongoose = require('mongoose');

const EvaluationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    company: {
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
    scores: {
      punctuality: { type: Number, min: 0, max: 10, default: 0 },
      teamwork: { type: Number, min: 0, max: 10, default: 0 },
      technicalSkills: { type: Number, min: 0, max: 10, default: 0 },
      communication: { type: Number, min: 0, max: 10, default: 0 },
      initiative: { type: Number, min: 0, max: 10, default: 0 },
      overallPerformance: { type: Number, min: 0, max: 10, default: 0 },
    },
    totalScore: {
      type: Number,
      default: 0,
    },
    comments: {
      type: String,
      maxlength: 2000,
    },
    recommendation: {
      type: String,
      enum: ['highly_recommended', 'recommended', 'neutral', 'not_recommended'],
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Calculate total score before saving
EvaluationSchema.pre('save', function (next) {
  const s = this.scores;
  const scores = [s.punctuality, s.teamwork, s.technicalSkills, s.communication, s.initiative, s.overallPerformance];
  const total = scores.reduce((sum, score) => sum + score, 0);
  this.totalScore = parseFloat((total / scores.length).toFixed(2));
  next();
});

module.exports = mongoose.model('Evaluation', EvaluationSchema);
