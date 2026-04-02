const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const House = require('../models/House');
const Landlord = require('../models/Landlord');
const { authenticateLandlord } = require('../config/auth');

const router = express.Router();

// Create upload directories
const uploadsDir = path.join(__dirname, '../uploads');
const imagesDir = path.join(uploadsDir, 'images');
const videosDir = path.join(uploadsDir, 'videos');

[uploadsDir, imagesDir, videosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'images' || file.fieldname.startsWith('image')) {
      cb(null, imagesDir);
    } else if (file.fieldname === 'video' || file.fieldname.startsWith('video')) {
      cb(null, videosDir);
    } else {
      cb(null, uploadsDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()  }-${  Math.round(Math.random() * 1E9)}`;
    cb(null, `${path.basename(file.originalname, path.extname(file.originalname))  }-${  uniqueSuffix  }${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'images' || file.fieldname.startsWith('image')) {
    const isImageMime = file.mimetype.startsWith('image/');
    const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.originalname);
    cb(null, isImageMime || hasImageExtension);
  } else if (file.fieldname === 'video' || file.fieldname.startsWith('video')) {
    const isVideoMime = file.mimetype.startsWith('video/');
    const hasVideoExtension = /\.(mp4|avi|mov|mkv|webm)$/i.test(file.originalname);
    cb(null, isVideoMime || hasVideoExtension);
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Get all properties for authenticated landlord
router.get('/', authenticateLandlord, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlordId).populate('properties');
    if (!landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    res.json({
      landlord: landlord.name,
      totalProperties: landlord.properties.length,
      properties: landlord.properties
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching properties', error: err.message });
  }
});

// Get single property
router.get('/:id', authenticateLandlord, async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json(house);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching property', error: err.message });
  }
});

// Create new property (Pending Admin Approval)
router.post('/', authenticateLandlord, upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, location, price, type, bedrooms, units, description, wifi, water, electricity } = req.body;

    const parsedUnits = parseInt(units, 10);
    if (!title || !location || !price || !type || !description) {
      return res.status(400).json({ message: 'Title, location, price, type, and description are required' });
    }
    if (isNaN(parsedUnits) || parsedUnits < 1) {
      return res.status(400).json({ message: 'Total units must be a valid number of at least 1' });
    }

    // Get landlord info from authenticated user (source of truth)
    const landlord = await Landlord.findById(req.landlordId);
    if (!landlord) {
      return res.status(401).json({ message: 'Landlord not found' });
    }

    // Get landlord info from database (source of truth)
    const landlordName = landlord.name || 'Unknown';
    const landlordEmail = landlord.email || '';
    const landlordPhone = landlord.phone || '';
    
    // Process uploaded files
    const imageFiles = req.files?.images || [];
    const videoFile = req.files?.video?.[0] || null;
    
    // Create image paths for database
    const imagePaths = imageFiles.map(file => `/uploads/images/${file.filename}`);
    const videoPath = videoFile ? `/uploads/videos/${videoFile.filename}` : null;
    
    const house = new House({
      title,
      location,
      price: parseInt(price),
      type,
      bedrooms: bedrooms ? parseInt(bedrooms) : 0,
      units: parsedUnits,
      description,
      images: imagePaths,
      videos: videoPath ? [videoPath] : [],
      features: [],
      amenities: {
        wifi: wifi === 'true',
        water: water === 'true',
        electricity: electricity === 'true'
      },
      landlord: landlordName,
      landlordEmail: landlordEmail,
      landlordPhone: landlordPhone,
      contact: landlordPhone,  // Use phone as contact info
      landlordId: req.landlordId,  // Store landlord ID for later updates
      submittedBy: req.landlordId,
      available: true,
      approved: false  // New houses require admin approval
    });

    await house.save();

    // Add property to landlord's properties list
    await Landlord.findByIdAndUpdate(
      req.landlordId,
      { $push: { properties: house._id } }
    );

    res.status(201).json({
      message: 'Property submitted successfully! Awaiting admin approval.',
      property: house,
      status: 'pending'
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating property', error: err.message });
  }
});

// Update property
router.patch('/:id', authenticateLandlord, async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Only allow landlord to update their own properties
    if (house.landlordId && house.landlordId.toString() !== req.landlordId) {
      return res.status(403).json({ message: 'Not authorized to update this property' });
    }

    const updatedHouse = await House.findByIdAndUpdate(req.params.id, req.body, { new: true });

    res.json({
      message: 'Property updated successfully',
      property: updatedHouse
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating property', error: err.message });
  }
});

// Delete property
router.delete('/:id', authenticateLandlord, async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) {
      return res.status(404).json({ message: 'Property not found' });
    }

    await House.findByIdAndDelete(req.params.id);

    // Remove from landlord's properties
    await Landlord.findByIdAndUpdate(
      req.landlordId,
      { $pull: { properties: req.params.id } }
    );

    res.json({ message: 'Property deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting property', error: err.message });
  }
});

// Toggle property availability
router.patch('/:id/toggle-availability', authenticateLandlord, async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) {
      return res.status(404).json({ message: 'Property not found' });
    }

    house.available = !house.available;
    await house.save();

    res.json({
      message: `Property is now ${house.available ? 'available' : 'unavailable'}`,
      property: house
    });
  } catch (err) {
    res.status(500).json({ message: 'Error toggling availability', error: err.message });
  }
});

// Get property statistics
router.get('/:id/stats', authenticateLandlord, async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json({
      propertyId: house._id,
      title: house.title,
      totalViews: house.views || 0,
      rating: house.rating || 0,
      available: house.available,
      createdAt: house.createdAt,
      updatedAt: house.updatedAt
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching statistics', error: err.message });
  }
});

/**
 * Admin approval route
 * POST /api/landlord-properties/:id/approve
 * Only admin can approve pending properties
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const { adminSecret } = req.body;
    
    // Simple admin verification (in production, use proper JWT/session)
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: 'Unauthorized. Admin access required.' });
    }

    const house = await House.findByIdAndUpdate(
      req.params.id,
      { approved: true },
      { new: true }
    );

    if (!house) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json({
      message: 'Property approved successfully!',
      property: house,
      status: 'approved'
    });
  } catch (err) {
    res.status(500).json({ message: 'Error approving property', error: err.message });
  }
});

/**
 * Get pending properties (for admin dashboard)
 * GET /api/landlord-properties/pending/all
 */
router.get('/pending/all', async (req, res) => {
  try {
    const { adminSecret } = req.query;
    
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: 'Unauthorized. Admin access required.' });
    }

    const pendingProperties = await House.find({ approved: false }).sort({ createdAt: -1 });

    res.json({
      totalPending: pendingProperties.length,
      properties: pendingProperties
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching pending properties', error: err.message });
  }
});

module.exports = router;