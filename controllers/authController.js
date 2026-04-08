const User = require('../models/User');
const Student = require('../models/Student');
const Company = require('../models/Company');

// Helper: generate token and send response
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    },
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, companyName } = req.body;

    // Create base user
    const user = await User.create({ name, email, password, role: role || 'student' });

    // Create profile based on role
    if (role === 'student') {
      await Student.create({ user: user._id });
    } else if (role === 'company') {
      await Company.create({
        user: user._id,
        companyName: companyName || name,
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Contact admin.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    let profile = null;

    if (req.user.role === 'student') {
      profile = await Student.findOne({ user: req.user.id }).populate('supervisor', 'name email');
    } else if (req.user.role === 'company') {
      profile = await Company.findOne({ user: req.user.id });
    }

    res.status(200).json({ success: true, user, profile });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/updateprofile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const fieldsToUpdate = { name: req.body.name, avatar: req.body.avatar };
    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    // Update role-specific profile
    if (req.user.role === 'student' && req.body.studentData) {
      await Student.findOneAndUpdate({ user: req.user.id }, req.body.studentData, { new: true });
    }
    if (req.user.role === 'company' && req.body.companyData) {
      await Company.findOneAndUpdate({ user: req.user.id }, req.body.companyData, { new: true });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, updateProfile };
