const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
    },
    checkIn: {
      type: String, // HH:MM format
    },
    checkOut: {
      type: String, // HH:MM format
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'half_day', 'remote'],
      default: 'present',
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    hoursWorked: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound index to prevent duplicate attendance per student per day
AttendanceSchema.index({ student: 1, internship: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
