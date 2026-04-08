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
    university: {
      type: String,
      default: '',
    },
    faculty: {
      type: String,
      default: '',
    },
    major: {
      type: String,
      default: '',
    },
    gpa: {
      type: Number,
      min: 0,
      max: 4,
      default: 0,
    },
    graduationYear: {
      type: Number,
    },
    skills: [String],
    bio: {
      type: String,
      maxlength: 500,
    },
    resume: {
      type: String, // URL or file path
    },
    phone: {
      type: String,
    },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', StudentSchema);
