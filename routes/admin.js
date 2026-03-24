const express = require('express');
const router = express.Router();
const House = require('../models/House');
const Student = require('../models/Student');
const Landlord = require('../models/Landlord');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const { authenticateAdmin } = require('../config/auth');
const logger = require('../config/logger');

// Protect all admin routes with authentication
router.use(authenticateAdmin);

// ========== DASHBOARD STATISTICS ==========

/**
 * GET /api/admin/stats
 * Returns dashboard statistics: user counts, property count, booking count, revenue
 */
router.get('/stats', async (req, res) => {
  try {
    const studentCount = await Student.countDocuments();
    const landlordCount = await Landlord.countDocuments();
    const propertyCount = await House.countDocuments();
    const bookingCount = await Booking.countDocuments();
    
    const revenueData = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

    res.json({
      students: studentCount,
      landlords: landlordCount,
      properties: propertyCount,
      bookings: bookingCount,
      revenue: totalRevenue,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching admin stats', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== USER MANAGEMENT ==========

/**
 * GET /api/admin/users
 * Returns all users (students + landlords) with pagination and search
 */
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = 'all' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const searchQuery = search ? {
      $or: [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ]
    } : {};

    let students = [];
    let landlords = [];
    let totalCount = 0;

    if (role === 'all' || role === 'student') {
      students = await Student.find(searchQuery)
        .select('_id email name phone createdAt status role')
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
      students = students.map(u => ({ ...u, role: 'student' }));
    }

    if (role === 'all' || role === 'landlord') {
      landlords = await Landlord.find(searchQuery)
        .select('_id email name phone createdAt status role')
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
      landlords = landlords.map(u => ({ ...u, role: 'landlord' }));
    }

    if (role === 'all') {
      totalCount = await Student.countDocuments(searchQuery) + 
                   await Landlord.countDocuments(searchQuery);
    } else if (role === 'student') {
      totalCount = await Student.countDocuments(searchQuery);
    } else {
      totalCount = await Landlord.countDocuments(searchQuery);
    }

    const allUsers = [...students, ...landlords];

    res.json({
      users: allUsers,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(totalCount / parseInt(limit))
    });
  } catch (error) {
    logger.error('Error fetching users', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/user/:userId/ban
 * Bans a user from the platform
 */
router.post('/user/:userId/ban', async (req, res) => {
  try {
    const { reason = 'No reason provided' } = req.body;
    
    // Try to ban as student first
    let user = await Student.findByIdAndUpdate(
      req.params.userId,
      { 
        status: 'banned', 
        banReason: reason, 
        bannedAt: new Date(),
        bannedBy: req.user._id
      },
      { new: true }
    );

    // If not found, try as landlord
    if (!user) {
      user = await Landlord.findByIdAndUpdate(
        req.params.userId,
        { 
          status: 'banned', 
          banReason: reason, 
          bannedAt: new Date(),
          bannedBy: req.user._id
        },
        { new: true }
      );
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`User ${req.params.userId} banned by admin ${req.user._id}`, { reason });
    res.json({ message: 'User banned successfully', user });
  } catch (error) {
    logger.error('Error banning user', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/user/:userId/unban
 * Unbans a user
 */
router.post('/user/:userId/unban', async (req, res) => {
  try {
    let user = await Student.findByIdAndUpdate(
      req.params.userId,
      { 
        status: 'active', 
        banReason: null, 
        bannedAt: null,
        bannedBy: null
      },
      { new: true }
    );

    if (!user) {
      user = await Landlord.findByIdAndUpdate(
        req.params.userId,
        { 
          status: 'active', 
          banReason: null, 
          bannedAt: null,
          bannedBy: null
        },
        { new: true }
      );
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`User ${req.params.userId} unbanned by admin ${req.user._id}`);
    res.json({ message: 'User unbanned successfully', user });
  } catch (error) {
    logger.error('Error unbanning user', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== PROPERTY MANAGEMENT ==========

/**
 * GET /api/admin/properties
 * Returns all properties with moderation status
 */
router.get('/properties', async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = status !== 'all' ? { status } : {};

    const properties = await House.find(query)
      .populate('landlord', 'name email phone')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await House.countDocuments(query);

    res.json({
      properties,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    logger.error('Error fetching properties', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/property/:propertyId/approve
 * Approves a property listing
 */
router.post('/property/:propertyId/approve', async (req, res) => {
  try {
    const property = await House.findByIdAndUpdate(
      req.params.propertyId,
      { 
        status: 'approved', 
        approvedAt: new Date(), 
        approvedBy: req.user._id 
      },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    logger.info(`Property ${req.params.propertyId} approved by admin ${req.user._id}`);
    res.json({ message: 'Property approved', property });
  } catch (error) {
    logger.error('Error approving property', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/property/:propertyId/reject
 * Rejects a property listing
 */
router.post('/property/:propertyId/reject', async (req, res) => {
  try {
    const { reason = 'No reason provided' } = req.body;

    const property = await House.findByIdAndUpdate(
      req.params.propertyId,
      { 
        status: 'rejected', 
        rejectionReason: reason,
        rejectedAt: new Date(),
        rejectedBy: req.user._id
      },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    logger.info(`Property ${req.params.propertyId} rejected by admin ${req.user._id}`, { reason });
    res.json({ message: 'Property rejected', property });
  } catch (error) {
    logger.error('Error rejecting property', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/property/:propertyId/remove
 * Removes a property from platform
 */
router.post('/property/:propertyId/remove', async (req, res) => {
  try {
    const { reason = 'No reason provided' } = req.body;

    const property = await House.findByIdAndUpdate(
      req.params.propertyId,
      { 
        status: 'removed', 
        removalReason: reason, 
        removedAt: new Date(),
        removedBy: req.user._id
      },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    logger.info(`Property ${req.params.propertyId} removed by admin ${req.user._id}`, { reason });
    res.json({ message: 'Property removed', property });
  } catch (error) {
    logger.error('Error removing property', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== PAYMENT VERIFICATION ==========

/**
 * GET /api/admin/payments
 * Returns all payments for verification with optional filtering
 */
router.get('/payments', async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = status !== 'all' ? { status } : {};

    const payments = await Payment.find(query)
      .populate('booking', 'checkInDate checkOutDate amount')
      .populate('student', 'email name phone')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Payment.countDocuments(query);

    res.json({
      payments,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    logger.error('Error fetching payments', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/payment/:paymentId/verify
 * Marks a payment as verified
 */
router.post('/payment/:paymentId/verify', async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.paymentId,
      { 
        status: 'verified', 
        verifiedAt: new Date(), 
        verifiedBy: req.user._id 
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    logger.info(`Payment ${req.params.paymentId} verified by admin ${req.user._id}`);
    res.json({ message: 'Payment verified', payment });
  } catch (error) {
    logger.error('Error verifying payment', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== ANALYTICS & REPORTING ==========

/**
 * GET /api/admin/analytics
 * Returns analytics and trends
 */
router.get('/analytics', async (req, res) => {
  try {
    // Monthly booking trend
    const monthlyBookings = await Booking.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 12 }
    ]);

    // Top properties by bookings
    const topProperties = await Booking.aggregate([
      {
        $group: {
          _id: '$house',
          bookings: { $sum: 1 }
        }
      },
      { $sort: { bookings: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'houses',
          localField: '_id',
          foreignField: '_id',
          as: 'property'
        }
      },
      { $unwind: '$property' }
    ]);

    // User growth trend
    const userGrowth = await Student.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 12 }
    ]);

    // Revenue trend
    const revenueTrend = await Payment.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 12 }
    ]);

    res.json({
      monthlyBookings,
      topProperties,
      userGrowth,
      revenueTrend
    });
  } catch (error) {
    logger.error('Error fetching analytics', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
