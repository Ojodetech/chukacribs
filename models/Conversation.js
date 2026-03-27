const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Landlord',
      required: true
    },
    houseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'House'
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 200
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'closed'],
      default: 'active'
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    },
    lastMessageContent: String,
    lastMessageSender: String,
    unreadCount: {
      student: { type: Number, default: 0 },
      landlord: { type: Number, default: 0 }
    },
    participantStatus: {
      studentActive: { type: Boolean, default: true },
      landlordActive: { type: Boolean, default: true }
    },
    messageCount: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Compound index for finding conversations
conversationSchema.index({ studentId: 1, landlordId: 1 });
conversationSchema.index({ studentId: 1, lastMessageAt: -1 });
conversationSchema.index({ landlordId: 1, lastMessageAt: -1 });

// Method to get or create conversation
conversationSchema.statics.getOrCreate = async function(studentId, landlordId, houseId = null) {
  let conversation = await this.findOne({ studentId, landlordId });
  
  if (!conversation) {
    conversation = new this({
      studentId,
      landlordId,
      houseId
    });
    await conversation.save();
  }
  
  return conversation;
};

module.exports = mongoose.model('Conversation', conversationSchema);
