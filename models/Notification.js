const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      enum: [
        'application_submitted',
        'application_accepted',
        'application_rejected',
        'application_reviewing',
        'report_submitted',
        'report_reviewed',
        'report_approved',
        'evaluation_submitted',
        'internship_posted',
        'task',
        'general',
      ],
      default: 'general',
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    link: {
      type: String, // front-end link to navigate to
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed, // internshipId, applicationId, etc.
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', NotificationSchema);
