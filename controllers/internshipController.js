const Internship = require('../models/Internship');
const Application = require('../models/Application');
const Company = require('../models/Company');

// @desc    Get all internships (with filters)
// @route   GET /api/internships
// @access  Public
const getInternships = async (req, res, next) => {
  try {
    const { category, type, location, search, status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) query.status = status;
    else query.status = 'open';

    if (category) query.category = category;
    if (type) query.type = type;
    if (location) query.location = { $regex: location, $options: 'i' };
    if (search) query.$text = { $search: search };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Internship.countDocuments(query);

    const internships = await Internship.find(query)
      .populate('company', 'name avatar')
      .populate('companyProfile', 'companyName logo industry location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: internships.length,
      total,
      pages: Math.ceil(total / parseInt(limit)),
      data: internships,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single internship
// @route   GET /api/internships/:id
// @access  Public
const getInternship = async (req, res, next) => {
  try {
    const internship = await Internship.findById(req.params.id)
      .populate('company', 'name avatar')
      .populate('companyProfile', 'companyName logo industry location description website');

    if (!internship) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }
    res.status(200).json({ success: true, data: internship });
  } catch (error) {
    next(error);
  }
};

// @desc    Create internship
// @route   POST /api/internships
// @access  Private (company)
const createInternship = async (req, res, next) => {
  try {
    const companyProfile = await Company.findOne({ user: req.user.id });
    const internship = await Internship.create({
      ...req.body,
      company: req.user.id,
      companyProfile: companyProfile?._id,
    });
    res.status(201).json({ success: true, data: internship });
  } catch (error) {
    next(error);
  }
};

// @desc    Update internship
// @route   PUT /api/internships/:id
// @access  Private (company owner or admin)
const updateInternship = async (req, res, next) => {
  try {
    let internship = await Internship.findById(req.params.id);
    if (!internship) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }
    if (internship.company.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this internship' });
    }
    internship = await Internship.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: internship });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete internship
// @route   DELETE /api/internships/:id
// @access  Private (company owner or admin)
const deleteInternship = async (req, res, next) => {
  try {
    const internship = await Internship.findById(req.params.id);
    if (!internship) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }
    if (internship.company.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this internship' });
    }
    await internship.deleteOne();
    res.status(200).json({ success: true, message: 'Internship deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get company's own internships
// @route   GET /api/internships/my
// @access  Private (company)
const getMyInternships = async (req, res, next) => {
  try {
    const internships = await Internship.find({ company: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: internships.length, data: internships });
  } catch (error) {
    next(error);
  }
};

module.exports = { getInternships, getInternship, createInternship, updateInternship, deleteInternship, getMyInternships };
