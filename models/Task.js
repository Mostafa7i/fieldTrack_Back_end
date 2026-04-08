const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true
  },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deadline: {
    type: Date,
    required: [true, 'Deadline is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'submitted', 'completed', 'overdue'],
    default: 'pending'
  },
  studentNote: {
    type: String,
    trim: true,
    default: ''
  },
  submittedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Auto-mark overdue tasks
taskSchema.pre('save', function(next) {
  if (this.deadline < new Date() && this.status === 'pending') {
    this.status = 'overdue';
  }
  next();
});

module.exports = mongoose.model('Task', taskSchema);
