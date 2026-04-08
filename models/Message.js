const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      maxlength: 2000,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    attachment: {
      type: String, // URL
    },
    messageType: {
      type: String,
      enum: ['text', 'file', 'system'],
      default: 'text',
    },
  },
  { timestamps: true }
);

MessageSchema.index({ sender: 1, receiver: 1 });

module.exports = mongoose.model('Message', MessageSchema);
