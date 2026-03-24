const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    senderType: {
      type: String,
      enum: ['student', 'landlord'],
      required: true
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    receiverType: {
      type: String,
      enum: ['student', 'landlord'],
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    type: {
      type: String,
      enum: ['text', 'image', 'document'],
      default: 'text'
    },
    attachments: [{
      url: String,
      filename: String,
      size: Number,
      type: String
    }],
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: Date,
    deleted: {
      type: Boolean,
      default: false
    },
    edited: {
      type: Boolean,
      default: false
    },
    editedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

// Index for conversation messages
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, read: 1 });

module.exports = mongoose.model('Message', messageSchema);
