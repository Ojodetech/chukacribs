const express = require('express');
const { body, validationResult, query } = require('express-validator');
const jwt = require('jsonwebtoken');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Student = require('../models/Student');
const Landlord = require('../models/Landlord');
const { handleValidationErrors, CustomValidators } = require('../config/validation');
const logger = require('../config/logger');

const router = express.Router();

// ========== MIDDLEWARE ==========

const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {return res.status(401).json({ success: false, message: 'No token provided' });}

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ========== CONVERSATION MANAGEMENT ==========

/**
 * GET /api/messages/conversations - Get all conversations
 */
router.get('/conversations', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn(['active', 'archived', 'closed'])
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'active';

    const query = { status };
    if (req.user.role === 'student') {
      query.studentId = req.user.id;
    } else if (req.user.role === 'landlord') {
      query.landlordId = req.user.id;
    }

    const total = await Conversation.countDocuments(query);
    const conversations = await Conversation.find(query)
      .populate('studentId', 'firstName lastName')
      .populate('landlordId', 'name')
      .populate('houseId', 'title')
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      conversations
    });
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Error fetching conversations', error: error.message });
  }
});

/**
 * POST /api/messages/conversations - Create or get conversation
 */
router.post('/conversations', authenticate, [
  body('otherUserId').notEmpty().withMessage('Other user ID is required'),
  body('houseId').optional()
], async (req, res) => {
  try {
    const { otherUserId, houseId } = req.body;

    let conversation;

    if (req.user.role === 'student') {
      conversation = await Conversation.getOrCreate(req.user.id, otherUserId, houseId);
    } else if (req.user.role === 'landlord') {
      conversation = await Conversation.getOrCreate(otherUserId, req.user.id, houseId);
    }

    res.json({
      success: true,
      message: 'Conversation ready',
      conversation
    });
  } catch (error) {
    logger.error('Create conversation error:', error);
    res.status(500).json({ success: false, message: 'Error creating conversation', error: error.message });
  }
});

/**
 * GET /api/messages/conversations/:id - Get conversation details
 */
router.get('/conversations/:id', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('studentId', 'firstName lastName profilePicture')
      .populate('landlordId', 'name profilePicture')
      .populate('houseId', 'title location');

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Check access
    const isStudent = req.user.role === 'student' && conversation.studentId._id.toString() === req.user.id;
    const isLandlord = req.user.role === 'landlord' && conversation.landlordId._id.toString() === req.user.id;

    if (!isStudent && !isLandlord) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const messageCount = await Message.countDocuments({ conversationId: req.params.id });
    const messages = await Message.find({ conversationId: req.params.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Mark as read
    if (isStudent) {
      await Message.updateMany(
        { conversationId: req.params.id, receiverId: req.user.id, read: false },
        { $set: { read: true, readAt: new Date() } }
      );
      conversation.unreadCount.student = 0;
    } else if (isLandlord) {
      await Message.updateMany(
        { conversationId: req.params.id, receiverId: req.user.id, read: false },
        { $set: { read: true, readAt: new Date() } }
      );
      conversation.unreadCount.landlord = 0;
    }

    await conversation.save();

    res.json({
      success: true,
      conversation,
      messages: messages.reverse(),
      pagination: { total: messageCount, page, limit, pages: Math.ceil(messageCount / limit) }
    });
  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({ success: false, message: 'Error fetching conversation', error: error.message });
  }
});

// ========== MESSAGING ==========

/**
 * POST /api/messages - Send message
 */
router.post('/', authenticate, [
  body('conversationId')
    .trim()
    .isMongoId()
    .withMessage('Invalid conversation ID')
    .custom(CustomValidators.noNoSQLInjection),
  body('receiverId')
    .trim()
    .isMongoId()
    .withMessage('Invalid receiver ID')
    .custom(CustomValidators.noNoSQLInjection),
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be 1-2000 characters')
    .custom(CustomValidators.noXSS)
    .custom(CustomValidators.noNoSQLInjection)
], handleValidationErrors, async (req, res) => {
  try {
    const { conversationId, receiverId, content, attachments } = req.body;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Verify access
    const isStudent = req.user.role === 'student' && conversation.studentId.toString() === req.user.id;
    const isLandlord = req.user.role === 'landlord' && conversation.landlordId.toString() === req.user.id;

    if (!isStudent && !isLandlord) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const message = new Message({
      conversationId,
      senderId: req.user.id,
      senderType: req.user.role,
      receiverId,
      receiverType: isStudent ? 'landlord' : 'student',
      content,
      attachments: attachments || [],
      read: false
    });

    await message.save();

    // Update conversation
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageContent = content;
    conversation.lastMessageSender = req.user.role;
    conversation.messageCount += 1;

    if (isStudent) {
      conversation.unreadCount.landlord += 1;
    } else {
      conversation.unreadCount.student += 1;
    }

    await conversation.save();

    logger.info(`Message sent in conversation ${conversationId}`);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      message: message.toObject()
    });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Error sending message', error: error.message });
  }
});

/**
 * PATCH /api/messages/:id - Edit message
 */
router.patch('/:id', authenticate, [
  body('content').trim().notEmpty().isLength({ min: 1, max: 2000 })
], async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.senderId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Can only edit your own messages' });
    }

    message.content = req.body.content;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    logger.info(`Message edited: ${message._id}`);

    res.json({
      success: true,
      message: 'Message updated successfully',
      message
    });
  } catch (error) {
    logger.error('Edit message error:', error);
    res.status(500).json({ success: false, message: 'Error editing message', error: error.message });
  }
});

/**
 * DELETE /api/messages/:id - Delete message
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.senderId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Can only delete your own messages' });
    }

    message.deleted = true;
    await message.save();

    logger.info(`Message deleted: ${message._id}`);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    logger.error('Delete message error:', error);
    res.status(500).json({ success: false, message: 'Error deleting message', error: error.message });
  }
});

/**
 * PATCH /api/messages/conversations/:id/archive - Archive conversation
 */
router.patch('/conversations/:id/archive', authenticate, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const isStudent = req.user.role === 'student' && conversation.studentId.toString() === req.user.id;
    const isLandlord = req.user.role === 'landlord' && conversation.landlordId.toString() === req.user.id;

    if (!isStudent && !isLandlord) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    conversation.status = 'archived';
    await conversation.save();

    logger.info(`Conversation archived: ${conversation._id}`);

    res.json({
      success: true,
      message: 'Conversation archived successfully'
    });
  } catch (error) {
    logger.error('Archive conversation error:', error);
    res.status(500).json({ success: false, message: 'Error archiving conversation', error: error.message });
  }
});

module.exports = router;
