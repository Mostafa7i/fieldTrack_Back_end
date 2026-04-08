const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema(
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
    coverLetter: {
      type: String,
      maxlength: 2000,
    },
    resume: {
      type: String, // URL
    },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
    },
    notes: {
      type: String, // company internal notes
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Prevent duplicate applications
ApplicationSchema.index({ student: 1, internship: 1 }, { unique: true });

module.exports = mongoose.model('Application', ApplicationSchema);
