const express = require('express');
const asyncHandler = require('express-async-handler');
const { body, param, query, validationResult } = require('express-validator');
const House = require('../models/House');
const Landlord = require('../models/Landlord');
const logger = require('../config/logger');
const { authenticateLandlord } = require('../config/auth');
const { upload } = require('../config/multer');
const {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  BadRequestError
} = require('../config/errors');

const router = express.Router();

// Admin approval secret middleware (deprecated) - use token-based adminAuth instead
const { adminAuth, adminRateLimiter } = require('../config/adminAuth');
const requireAdminSecret = adminAuth;

// Admin JWT verification middleware
const requireAdminJWT = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'No authorization token' });
    }
    
    const jwt = require('jsonwebtoken');
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        req.adminId = decoded.adminId || 'admin';
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

// Get all houses (only approved listings visible) with optional filters
router.get('/', asyncHandler(async (req, res) => {
    const { location, minPrice, maxPrice, type, page = 1, limit = 20, sort } = req.query;
    const query = { available: true, approved: true };

    if (location) {
        query.location = { $regex: location, $options: 'i' };
    }

    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) { query.price.$gte = parseInt(minPrice, 10); }
        if (maxPrice) { query.price.$lte = parseInt(maxPrice, 10); }
    }

    if (type) {
        query.type = type;
    }

    // Parse pagination parameters
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    // Default sorting
    let sortOptions = { createdAt: -1 };
    if (sort === 'price') {
        sortOptions = { price: 1 };
    } else if (sort === '-price') {
        sortOptions = { price: -1 };
    } else if (sort === 'createdAt') {
        sortOptions = { createdAt: 1 };
    }

    const houses = await House.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .select('_id title location price type bedrooms description amenities images landlordName contact')
        .lean();

    res.json(houses || []);
}));

// Get pending properties (admin)
router.get('/admin/pending', async (req, res) => {
    try {
        // Check for admin JWT in cookie
        let isAdmin = false;
        const adminToken = req.cookies?.adminToken;

        console.log('Pending properties request:');
        console.log('  Cookie adminToken:', adminToken ? '✓ Found' : '✗ Not found');
        
        if (adminToken) {
            const jwt = require('jsonwebtoken');
            try {
                const decoded = jwt.verify(adminToken, process.env.JWT_SECRET);
                console.log('  Token decoded:', decoded);
                if (decoded.role === 'admin') {
                    isAdmin = true;
                    console.log('  ✓ Authenticated via cookie token');
                }
            } catch (err) {
                console.log('  ✗ Token verification failed:', err.message);
            }
        }

        if (!isAdmin) {
            console.log('  ✗ Admin access denied');
            throw AuthorizationError.insufficientRole('Admin access required');
        }

        const pending = await House.find({ approved: false }).sort({ createdAt: -1 });
        console.log('  Returning', pending.length, 'pending properties');
        res.json({ houses: pending });
    } catch (err) {
        throw err;
    }
});

// Get single house
router.get('/:id', [
    param('id').isMongoId().withMessage('Invalid house ID format')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw ValidationError.fromValidationResult(errors);
    }

    const house = await House.findByIdAndUpdate(
        req.params.id,
        { $inc: { views: 1 } },
        { new: true }
    );
    if (!house) {
        throw NotFoundError.houseNotFound(req.params.id);
    }
    res.json(house);
}));

// Search houses with filters (only approved)
router.get('/search/query', [
    query('q').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Search term must be 2-200 characters'),
    query('minPrice').optional().isInt({ min: 0, max: 10000000 }).withMessage('Min price must be 0-10,000,000'),
    query('maxPrice').optional().isInt({ min: 0, max: 10000000 }).withMessage('Max price must be 0-10,000,000'),
    query('type').optional().isIn(['studio', 'single', '2-bedroom', '3-bedroom', '4-bedroom', 'multi-bedroom']).withMessage('Invalid property type'),
    query('location').optional().trim().isLength({ max: 100 }).withMessage('Location must be max 100 characters'),
    query('bedrooms').optional().isInt({ min: 0, max: 10 }).withMessage('Bedrooms must be 0-10'),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be 1-100'),
    query('skip').optional().isInt({ min: 0 }).toInt().withMessage('Skip must be >= 0')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw ValidationError.fromValidationResult(errors);
    }

    const { q, minPrice, maxPrice, type, location, bedrooms, limit = 20, skip = 0 } = req.query;
    const query = { available: true, approved: true };

    if (q) {
        query.$or = [
            { title: { $regex: q, $options: 'i' } },
            { location: { $regex: q, $options: 'i' } },
            { description: { $regex: q, $options: 'i' } }
        ];
    }

    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) {query.price.$gte = parseInt(minPrice);}
        if (maxPrice) {query.price.$lte = parseInt(maxPrice);}
    }

    if (type) {
        query.type = type;
    }

    if (location) {
        query.location = { $regex: location, $options: 'i' };
    }

    if (bedrooms) {
        query.bedrooms = parseInt(bedrooms);
    }

    const houses = await House.find(query).sort({ createdAt: -1 }).limit(parseInt(limit)).skip(parseInt(skip));
    const total = await House.countDocuments(query);
    res.json({ houses, total, limit: parseInt(limit), skip: parseInt(skip) });
}));

// Middleware to handle file uploads with error handling
const handleUploads = (req, res, next) => {
    upload.fields([
        { name: 'images', maxCount: 10 },
        { name: 'video', maxCount: 1 }
    ])(req, res, (err) => {
        if (err) {
            console.error('Upload error:', err.message);
            throw BadRequestError.fileSizeExceeded(err.message);
        }
        
        console.log('Files uploaded successfully:', { 
            images: req.files?.images?.length || 0, 
            video: req.files?.video?.length || 0 
        });
        next();
    });
};

// Create house (landlord) with file uploads
router.post('/', authenticateLandlord, handleUploads, async (req, res) => {
    try {
        console.log('Request body fields:', Object.keys(req.body));
        console.log('Files received:', req.files);
        
        // Validate required fields
        if (!req.body.title || !req.body.location || !req.body.price || !req.body.type || !req.body.bedrooms || !req.body.description) {
            throw BadRequestError.missingRequired('title, location, price, type, bedrooms, description');
        }

        // Validate at least one image
        if (!req.files?.images || req.files.images.length === 0) {
            throw BadRequestError.missingRequired('At least one image is required');
        }

        // Process image files
        const images = (req.files.images || [])
            .map(file => `/uploads/images/${file.filename}`);

        // Process video file
        const videos = [];
        if (req.files?.video && req.files.video.length > 0) {
            videos.push(`/uploads/videos/${req.files.video[0].filename}`);
        }

        const house = new House({
            title: req.body.title,
            location: req.body.location,
            price: parseInt(req.body.price),
            type: req.body.type,
            bedrooms: parseInt(req.body.bedrooms),
            description: req.body.description,
            images: images,
            videos: videos,
            landlordId: req.landlordId,
            landlord: req.landlordName || req.body.landlord || 'Landlord',
            landlordEmail: req.landlordEmail || req.body.landlordEmail || '',
            landlordPhone: req.landlordPhone || req.body.landlordPhone || '',
            contact: req.body.contact || 'Contact via dashboard',
            submittedBy: req.landlordId.toString(),
            amenities: {
                wifi: req.body.wifi === 'true',
                water: req.body.water === 'true',
                electricity: req.body.electricity === 'true'
            },
            approved: false,
            available: true,
            status: req.body.status || 'pending'
        });

        const newHouse = await house.save();
        
        // Add property to landlord's properties array
        const landlord = await Landlord.findByIdAndUpdate(
            req.landlordId,
            { $push: { properties: newHouse._id } },
            { new: true }
        );
        
        console.log('Property added to landlord:', landlord.email);
        res.status(201).json(newHouse);
    } catch (err) {
        console.error('Error creating house:', err);
        console.error('Error details:', {
            name: err.name,
            message: err.message,
            errors: err.errors || err.validationErrors
        });
        
        // Handle validation errors specifically
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors || {})
                .map(e => e.message)
                .join('; ');
            throw DatabaseError.fromMongooseError(err);
        }
        
        throw err;
    }
});

// Update house (admin)
router.patch('/:id', adminRateLimiter, requireAdminSecret, async (req, res) => {
    try {
        const house = await House.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!house) {
            throw NotFoundError.houseNotFound(req.params.id);
        }
        logger.info(`House ${req.params.id} updated by admin`);
        res.json(house);
    } catch (err) {
        throw err;
    }
});

// Approve property (admin - accepts both secret key and JWT)
router.post('/:id/approve', adminRateLimiter, requireAdminSecret, async (req, res) => {
    try {
        // Check for admin JWT or secret key
        const adminSecret = req.headers['x-admin-secret'];
        const authHeader = req.headers['authorization'];
        
        let isAdmin = false;
        
        // Method 1: Check secret key
        if (adminSecret === process.env.ADMIN_SECRET_KEY) {
            isAdmin = true;
        }
        // Method 2: Check JWT token
        else if (authHeader) {
            const token = authHeader.split(' ')[1];
            if (token) {
                const jwt = require('jsonwebtoken');
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    if (decoded.role === 'admin') {
                        isAdmin = true;
                    }
                } catch (err) {
                    // JWT verification failed, fall through
                }
            }
        }
        
        if (!isAdmin) {
            throw AuthorizationError.insufficientRole('Admin access required');
        }

        const house = await House.findByIdAndUpdate(
            req.params.id,
            { approved: true },
            { new: true }
        );
        if (!house) {
            throw NotFoundError.houseNotFound(req.params.id);
        }
        logger.info(`Property ${req.params.id} approved by admin`);
        res.json({ message: 'Property approved successfully', property: house });
    } catch (err) {
        throw err;
    }
});

// Delete house (landlord - only their own properties)
router.delete('/:id/landlord', authenticateLandlord, async (req, res) => {
    try {
        const house = await House.findById(req.params.id);
        
        if (!house) {
            throw NotFoundError.houseNotFound(req.params.id);
        }

        // Check if landlord owns this property
        if (house.landlordId.toString() !== req.landlordId.toString()) {
            throw AuthorizationError.resourceNotOwned('You do not have permission to delete this property');
        }

        await House.findByIdAndDelete(req.params.id);
        logger.info(`Property ${req.params.id} deleted by landlord ${req.landlordId}`);
        res.json({ message: 'Property deleted successfully' });
    } catch (err) {
        throw err;
    }
});

// Delete house (admin - accepts both secret key and JWT)
router.delete('/:id', adminRateLimiter, requireAdminSecret, async (req, res) => {
    try {
        // Check for admin JWT or secret key
        const adminSecret = req.headers['x-admin-secret'];
        const authHeader = req.headers['authorization'];
        
        let isAdmin = false;
        
        // Method 1: Check secret key
        if (adminSecret === process.env.ADMIN_SECRET_KEY) {
            isAdmin = true;
        }
        // Method 2: Check JWT token
        else if (authHeader) {
            const token = authHeader.split(' ')[1];
            if (token) {
                const jwt = require('jsonwebtoken');
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    if (decoded.role === 'admin') {
                        isAdmin = true;
                    }
                } catch (err) {
                    // JWT verification failed, fall through
                }
            }
        }
        
        if (!isAdmin) {
            return res.status(403).json({ message: 'Unauthorized: Admin access required' });
        }
        
        const house = await House.findByIdAndDelete(req.params.id);
        if (!house) {
            return res.status(404).json({ message: 'House not found' });
        }
        logger.info(`Property ${req.params.id} deleted by admin`);
        res.json({ message: 'House deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting house', error: err.message });
    }
});

// Get houses by type
router.get('/type/:type', asyncHandler(async (req, res) => {
    const houses = await House.find({ 
        type: req.params.type, 
        available: true 
    }).sort({ price: 1 });
    res.json(houses);
}));

// Get houses by location
router.get('/location/:location', asyncHandler(async (req, res) => {
    const houses = await House.find({ 
        location: { $regex: req.params.location, $options: 'i' },
        available: true 
    }).sort({ createdAt: -1 });
    res.json(houses);
}));

module.exports = router;