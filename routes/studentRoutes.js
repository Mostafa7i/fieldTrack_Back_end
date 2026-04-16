const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Student = require('../models/Student');

// @desc    Get my student profile (full, including preferences)
// @route   GET /api/students/me
// @access  Private (student)
router.get('/me', protect, authorize('student'), async (req, res, next) => {
  try {
    const profile = await Student.findOne({ user: req.user.id }).populate('supervisor', 'name email');
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

// @desc    Update student profile + preferences
// @route   PUT /api/students/me
// @access  Private (student)
router.put('/me', protect, authorize('student'), async (req, res, next) => {
  try {
    const allowed = [
      'studentId', 'university', 'faculty', 'major', 'gpa', 'graduationYear',
      'skills', 'bio', 'phone', 'resume',
      'preferredCategories', 'preferredTypes', 'preferredLocations',
      'availableFrom', 'careerGoals', 'languages', 'hobbies',
      'linkedIn', 'github', 'portfolio', 'profileCompleted',
    ];
    const updateData = {};
    const unsetData = {};
    
    allowed.forEach(key => { 
      if (req.body[key] !== undefined) {
        if (key === 'studentId' && req.body[key] === '') {
          unsetData[key] = 1;
        } else {
          updateData[key] = req.body[key]; 
        }
      } 
    });

    const updateObj = Object.keys(updateData).length > 0 ? { $set: updateData } : {};
    if (Object.keys(unsetData).length > 0) updateObj.$unset = unsetData;

    const profile = await Student.findOneAndUpdate(
      { user: req.user.id },
      updateObj,
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

module.exports = router;
