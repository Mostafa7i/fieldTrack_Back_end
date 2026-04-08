const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    industry: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    website: {
      type: String,
    },
    location: {
      city: String,
      country: String,
      address: String,
    },
    logo: {
      type: String,
    },
    phone: {
      type: String,
    },
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '500+'],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', CompanySchema);
