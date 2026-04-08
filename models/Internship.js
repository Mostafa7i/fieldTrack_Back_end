const mongoose = require('mongoose');

const InternshipSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    companyProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
    },
    title: {
      type: String,
      required: [true, 'Internship title is required'],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: 3000,
    },
    requirements: {
      type: String,
      maxlength: 2000,
    },
    skills: [String],
    location: {
      type: String,
      default: 'Remote',
    },
    type: {
      type: String,
      enum: ['full-time', 'part-time', 'remote', 'hybrid'],
      default: 'full-time',
    },
    duration: {
      type: String, // e.g. "3 months"
    },
    slots: {
      type: Number,
      default: 1,
      min: 1,
    },
    deadline: {
      type: Date,
      required: [true, 'Application deadline is required'],
    },
    startDate: {
      type: Date,
    },
    salary: {
      type: Number,
      default: 0,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'draft'],
      default: 'open',
    },
    applicationsCount: {
      type: Number,
      default: 0,
    },
    department: {
      type: String,
    },
    category: {
      type: String,
      enum: ['IT', 'Engineering', 'Marketing', 'Finance', 'Design', 'Science', 'Other'],
      default: 'Other',
    },
  },
  { timestamps: true }
);

// Index for search
InternshipSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Internship', InternshipSchema);
