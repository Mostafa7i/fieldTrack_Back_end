const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    studentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    university: { type: String, default: '' },
    faculty:    { type: String, default: '' },
    major:      { type: String, default: '' },
    gpa:        { type: Number, min: 0, max: 5, default: 0 },
    graduationYear: { type: Number },
    skills:     [String],
    bio:        { type: String, maxlength: 800 },
    resume:     { type: String },
    phone:      { type: String },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ── Preferences (used by AI recommendations) ──────────────────────────
    preferredCategories: {
      type: [String],
      default: [],
      // e.g. ['IT', 'Engineering', 'Design']
    },
    preferredTypes: {
      type: [String],
      default: [],
      // e.g. ['remote', 'hybrid', 'full-time']
    },
    preferredLocations: {
      type: [String],
      default: [],
      // e.g. ['Cairo', 'Remote']
    },
    availableFrom: {
      type: Date,
    },
    careerGoals: {
      type: String,
      maxlength: 600,
    },
    languages: {
      type: [String],   // e.g. ['Arabic', 'English']
      default: [],
    },
    hobbies: {
      type: [String],
      default: [],
    },

    // ── Social / Links ─────────────────────────────────────────────────────
    linkedIn:  { type: String, default: '' },
    github:    { type: String, default: '' },
    portfolio: { type: String, default: '' },

    // ── Onboarding flag ────────────────────────────────────────────────────
    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', StudentSchema);

