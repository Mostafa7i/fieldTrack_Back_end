const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Create Task (Supervisor only)
exports.createTask = async (req, res) => {
  try {
    const { title, description, studentId, deadline, priority } = req.body;
    const supervisorId = req.user.id;

    // Validate student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }

    const task = await Task.create({
      title,
      description,
      supervisor: supervisorId,
      student: studentId,
      deadline: new Date(deadline),
      priority: priority || 'medium'
    });

    // Send notification to student
    await Notification.create({
      recipient: studentId,
      sender: supervisorId,
      title: 'New Task Assigned',
      message: `Your supervisor has assigned you a new task: "${title}" — Due: ${new Date(deadline).toLocaleDateString()}`,
      type: 'task'
    });

    const populated = await Task.findById(task._id)
      .populate('student', 'name email')
      .populate('supervisor', 'name email');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('Create Task Error:', error);
    res.status(500).json({ message: 'Failed to create task', error: error.message });
  }
};

// Get all tasks for supervisor
exports.getSupervisorTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ supervisor: req.user.id })
      .populate('student', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tasks', error: error.message });
  }
};

// Get all tasks for student
exports.getStudentTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ student: req.user.id })
      .populate('supervisor', 'name email')
      .sort({ deadline: 1 });
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tasks', error: error.message });
  }
};

// Student updates task status / adds note
exports.updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, studentNote } = req.body;

    const task = await Task.findOne({ _id: id, student: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found or unauthorized' });

    const allowedStatusForStudent = ['in_progress', 'submitted'];
    if (!allowedStatusForStudent.includes(status)) {
      return res.status(400).json({ message: 'Invalid status update' });
    }

    task.status = status;
    if (studentNote !== undefined) task.studentNote = studentNote;
    if (status === 'submitted') task.submittedAt = new Date();
    await task.save();

    // Notify supervisor
    await Notification.create({
      recipient: task.supervisor,
      sender: req.user.id,
      title: `Task ${status === 'submitted' ? 'Submitted' : 'Updated'}`,
      message: `Student has ${status === 'submitted' ? 'submitted' : 'started working on'} the task: "${task.title}"`,
      type: 'task'
    });

    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update task', error: error.message });
  }
};

// Supervisor completes / closes a task
exports.closeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findOne({ _id: id, supervisor: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found or unauthorized' });

    task.status = 'completed';
    await task.save();

    await Notification.create({
      recipient: task.student,
      sender: req.user.id,
      title: 'Task Marked as Completed',
      message: `Your supervisor marked the task "${task.title}" as completed. Great work!`,
      type: 'task'
    });

    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ message: 'Failed to close task', error: error.message });
  }
};

// Delete task (supervisor only)
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findOneAndDelete({ _id: id, supervisor: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found or unauthorized' });
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete task', error: error.message });
  }
};
