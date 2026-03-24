const express = require('express');
const asyncHandler = require('express-async-handler');
const router = express.Router();
const House = require('../models/House');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const UserRating = require('../models/UserRating');
const Student = require('../models/Student');
const Landlord = require('../models/Landlord');
const { authenticateAdmin } = require('../config/auth');

// Landlord Dashboard Analytics
router.get('/landlord/:landlordId', asyncHandler(async (req, res) => {
    const landlordId = req.params.landlordId;

    // Property statistics
    const propertyStats = await House.aggregate([
      { $match: { landlordId: require('mongoose').Types.ObjectId(landlordId) } },
      {
        $group: {
          _id: null,
          totalProperties: { $sum: 1 },
          totalViews: { $sum: '$views' },
          activeProperties: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
          },
        },
      },
    ]);

    // Booking statistics
    const bookingStats = await Booking.aggregate([
      { $match: { landlordId: require('mongoose').Types.ObjectId(landlordId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'completed'] }, '$amount', 0],
            },
          },
        },
      },
    ]);

    // Monthly revenue trend
    const monthlyRevenue = await Booking.aggregate([
      {
        $match: {
          landlordId: require('mongoose').Types.ObjectId(landlordId),
          paymentStatus: 'completed',
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          revenue: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]);

    // Review statistics
    const reviewStats = await Review.aggregate([
      {
        $match: {
          landlordId: require('mongoose').Types.ObjectId(landlordId),
          verified: true,
        },
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
    ]);

    // Trust score
    const trustScore = await UserRating.calculateTrustScore(landlordId, 'Landlord');

    // Top performing properties
    const topProperties = await House.aggregate([
      { $match: { landlordId: require('mongoose').Types.ObjectId(landlordId) } },
      { $sort: { views: -1, booking: -1 } },
      { $limit: 5 },
      { $project: { title: 1, location: 1, views: 1, rating: 1, price: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        propertyStats: propertyStats[0] || {
          totalProperties: 0,
          totalViews: 0,
          activeProperties: 0,
        },
        bookingStats,
        monthlyRevenue,
        reviewStats: reviewStats[0] || {
          totalReviews: 0,
          averageRating: 0,
        },
        trustScore,
        topProperties,
      },
    });
}));

// Student Dashboard Analytics
router.get('/student/:studentId', asyncHandler(async (req, res) => {
    const studentId = req.params.studentId;

    // Booking statistics
    const bookingStats = await Booking.aggregate([
      { $match: { studentId: require('mongoose').Types.ObjectId(studentId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'completed'] }, '$amount', 0],
            },
          },
        },
      },
    ]);

    // Spending trend
    const spendingTrend = await Booking.aggregate([
      {
        $match: {
          studentId: require('mongoose').Types.ObjectId(studentId),
          paymentStatus: 'completed',
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          spent: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Recent bookings
    const recentBookings = await Booking.find({
      studentId: studentId,
    })
      .populate('houseId', 'title location price images')
      .sort({ createdAt: -1 })
      .limit(5);

    // Trust score
    const trustScore = await UserRating.calculateTrustScore(studentId, 'Student');

    // Reviews submitted
    const reviewsCount = await Review.countDocuments({
      studentId: studentId,
      verified: true,
    });

    // Saved houses count
    const { Favorite } = require('../models');
    const savedHouses = await Favorite.countDocuments({ studentId: studentId });

    res.json({
      success: true,
      data: {
        bookingStats,
        spendingTrend,
        recentBookings,
        trustScore,
        stats: {
          reviewsSubmitted: reviewsCount,
          savedHouses: savedHouses || 0,
          totalBookings: bookingStats.reduce((sum, b) => sum + b.count, 0),
        },
      },
    });
}));

// Platform Analytics (Admin)
router.get('/platform/overview', authenticateAdmin, async (req, res) => {
  try {
    // User statistics
    const studentCount = await Student.countDocuments();
    const landlordCount = await Landlord.countDocuments();

    // Booking statistics
    const bookingStats = await Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'completed'] }, '$amount', 0],
            },
          },
        },
      },
    ]);

    // Revenue trend
    const revenueTrend = await Booking.aggregate([
      {
        $match: { paymentStatus: 'completed' },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          revenue: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]);

    // Property statistics
    const propertyStats = await House.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Top cities
    const topCities = await House.aggregate([
      {
        $group: {
          _id: '$location',
          count: { $sum: 1 },
          views: { $sum: '$views' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Review statistics
    const reviewStats = await Review.aggregate([
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          verifiedReviews: {
            $sum: { $cond: [{ $eq: ['$verified', true] }, 1, 0] },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        userStats: {
          students: studentCount,
          landlords: landlordCount,
        },
        bookingStats,
        revenueTrend,
        propertyStats,
        topCities,
        reviewStats: reviewStats[0] || {
          totalReviews: 0,
          averageRating: 0,
          verifiedReviews: 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching platform analytics:', error);
    res.status(500).json({ success: false, message: 'Error fetching analytics' });
  }
});

// Property Performance Analytics
router.get('/property/:propertyId', asyncHandler(async (req, res) => {
    const propertyId = require('mongoose').Types.ObjectId(req.params.propertyId);

    // View and booking stats
    const performance = await House.aggregate([
      { $match: { _id: propertyId } },
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'houseId',
          as: 'bookings',
        },
      },
      {
        $project: {
          title: 1,
          views: 1,
          totalBookings: { $size: '$bookings' },
          completedBookings: {
            $size: {
              $filter: {
                input: '$bookings',
                as: 'booking',
                cond: { $eq: ['$$booking.status', 'completed'] },
              },
            },
          },
        },
      },
    ]);

    // Reviews for property
    const reviewData = await Review.aggregate([
      { $match: { houseId: propertyId, verified: true } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
    ]);

    // Monthly bookings
    const monthlyBookings = await Booking.aggregate([
      { $match: { houseId: propertyId } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      success: true,
      data: {
        performance: performance[0] || {},
        reviews: reviewData[0] || {},
        monthlyBookings,
      },
    });
}));

module.exports = router;
