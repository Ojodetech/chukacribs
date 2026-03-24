const express = require('express');
const { body, query, validationResult } = require('express-validator');
const router = express.Router();
const Favorite = require('../models/Favorite');
const House = require('../models/House');
const { authenticateStudent } = require('../config/auth');
const { asyncHandler } = require('../config/errorHandler');

/**
 * GET /api/favorites
 * Get all favorites for a student with pagination
 */
router.get(
  '/',
  authenticateStudent,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    const sortOption = req.query.sort || 'recent';
    let sortQuery = { createdAt: -1 };

    if (sortOption === 'price-low') {sortQuery = { 'house.price': 1 };}
    if (sortOption === 'price-high') {sortQuery = { 'house.price': -1 };}

    // Get count for pagination
    const total = await Favorite.countDocuments({ studentId: req.studentId });

    // Get favorites with house details
    const favorites = await Favorite.aggregate([
      { $match: { studentId: require('mongoose').Types.ObjectId(req.studentId) } },
      {
        $lookup: {
          from: 'houses',
          localField: 'houseId',
          foreignField: '_id',
          as: 'house',
        },
      },
      { $unwind: '$house' },
      { $sort: sortQuery },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          houseId: 1,
          savedAt: 1,
          notes: 1,
          reminderDate: 1,
          bookmarkName: 1,
          'house._id': 1,
          'house.title': 1,
          'house.price': 1,
          'house.location': 1,
          'house.bedrooms': 1,
          'house.images': { $slice: ['$house.images', 1] },
          'house.rating': 1,
          'house.landlordId': 1,
        },
      },
    ]);

    res.json({
      success: true,
      data: favorites,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

/**
 * POST /api/favorites/add/:houseId
 * Add a house to favorites
 */
router.post(
  '/add/:houseId',
  authenticateStudent,
  [
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes must be max 500 characters'),
    body('reminderDate').optional().isISO8601().withMessage('Invalid reminder date'),
    body('bookmarkName').optional().trim().isLength({ max: 100 }).withMessage('Bookmark name must be max 100 characters'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { houseId } = req.params;
    const { notes, reminderDate, bookmarkName } = req.body;

    // Verify house exists
    const house = await House.findById(houseId);
    if (!house) {
      return res.status(404).json({ success: false, message: 'House not found' });
    }

    // Check if already favorited
    const existing = await Favorite.findOne({ studentId: req.studentId, houseId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'House already in favorites' });
    }

    // Create favorite
    const favorite = new Favorite({
      studentId: req.studentId,
      houseId,
      notes,
      reminderDate,
      bookmarkName,
    });

    await favorite.save();

    res.status(201).json({
      success: true,
      message: 'Added to favorites',
      data: favorite,
    });
  })
);

/**
 * DELETE /api/favorites/:houseId
 * Remove from favorites
 */
router.delete(
  '/:houseId',
  authenticateStudent,
  asyncHandler(async (req, res) => {
    const { houseId } = req.params;

    const favorite = await Favorite.findOneAndDelete({
      studentId: req.studentId,
      houseId,
    });

    if (!favorite) {
      return res.status(404).json({ success: false, message: 'Favorite not found' });
    }

    res.json({
      success: true,
      message: 'Removed from favorites',
    });
  })
);

/**
 * POST /api/favorites/toggle/:houseId
 * Toggle favorite status for a house
 */
router.post(
  '/toggle/:houseId',
  authenticateStudent,
  asyncHandler(async (req, res) => {
    const { houseId } = req.params;

    // Verify house exists
    const house = await House.findById(houseId);
    if (!house) {
      return res.status(404).json({ success: false, message: 'House not found' });
    }

    const existing = await Favorite.findOne({ studentId: req.studentId, houseId });

    if (existing) {
      await Favorite.deleteOne({ _id: existing._id });
      return res.json({
        success: true,
        message: 'Removed from favorites',
        favorited: false,
      });
    } else {
      const favorite = new Favorite({
        studentId: req.studentId,
        houseId,
      });
      await favorite.save();
      return res.json({
        success: true,
        message: 'Added to favorites',
        favorited: true,
        data: favorite,
      });
    }
  })
);

/**
 * GET /api/favorites/check/:houseId
 * Check if a house is in favorites
 */
router.get(
  '/check/:houseId',
  authenticateStudent,
  asyncHandler(async (req, res) => {
    const { houseId } = req.params;

    const favorite = await Favorite.findOne({
      studentId: req.studentId,
      houseId,
    });

    res.json({
      success: true,
      isFavorited: !!favorite,
      favorite: favorite || null,
    });
  })
);

/**
 * GET /api/favorites/count/:houseId
 * Get the number of times a house has been favorited
 */
router.get(
  '/count/:houseId',
  asyncHandler(async (req, res) => {
    const { houseId } = req.params;

    const count = await Favorite.countDocuments({ houseId });

    res.json({
      success: true,
      houseId,
      favoriteCount: count,
    });
  })
);

/**
 * PATCH /api/favorites/:houseId
 * Update favorite notes or reminder date
 */
router.patch(
  '/:houseId',
  authenticateStudent,
  [
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes must be max 500 characters'),
    body('reminderDate').optional().isISO8601().withMessage('Invalid reminder date'),
    body('bookmarkName').optional().trim().isLength({ max: 100 }).withMessage('Bookmark name must be max 100 characters'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { houseId } = req.params;
    const { notes, reminderDate, bookmarkName } = req.body;

    const updateData = {};
    if (notes !== undefined) {updateData.notes = notes;}
    if (reminderDate !== undefined) {updateData.reminderDate = reminderDate;}
    if (bookmarkName !== undefined) {updateData.bookmarkName = bookmarkName;}

    const favorite = await Favorite.findOneAndUpdate(
      { studentId: req.studentId, houseId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!favorite) {
      return res.status(404).json({ success: false, message: 'Favorite not found' });
    }

    res.json({
      success: true,
      message: 'Favorite updated',
      data: favorite,
    });
  })
);

module.exports = router;
