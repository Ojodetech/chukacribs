const express = require('express');
const Booking = require('../models/Booking');
const House = require('../models/House');
const jwt = require('jsonwebtoken');
// const smsService = require('../services/smsService');

// Get booking expiration hours from env (default: 24 hours)
const BOOKING_EXPIRATION_HOURS = parseInt(process.env.BOOKING_EXPIRATION_HOURS || '24');
const EXPIRATION_TIME_MS = BOOKING_EXPIRATION_HOURS * 60 * 60 * 1000;

const router = express.Router();

/**
 * Create a booking (triggered after payment)
 * @route POST /api/bookings
 * @param {string} houseId - House ID
 * @param {string} userEmail - User email
 * @param {string} userName - User name
 * @param {string} userPhone - User phone (for SMS)
 * @param {string} moveInDate - Move-in date
 * @param {string} tokenUsed - Access token used
 */
router.post('/', async (req, res) => {
    try {
        const { houseId, userEmail, userName, userPhone, moveInDate, tokenUsed } = req.body;

        // Validate required fields
        if (!houseId || !userEmail || !userName || !userPhone || !moveInDate) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: houseId, userEmail, userName, userPhone, moveInDate'
            });
        }

        // Get house details
        const house = await House.findById(houseId);
        if (!house) {
            return res.status(404).json({
                success: false,
                message: 'House not found'
            });
        }

        // Idempotent booking support using idempotency key
        const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;
        if (idempotencyKey) {
            const existing = await Booking.findOne({ idempotencyKey });
            if (existing) {
                return res.status(200).json({
                    success: true,
                    message: 'Booking already processed (idempotent request)',
                    booking: existing
                });
            }
        }

        // Create booking
        const booking = new Booking({
            houseId,
            userEmail: userEmail.toLowerCase(),
            userName,
            userPhone,
            moveInDate: new Date(moveInDate),
            status: 'confirmed',
            tokenUsed,
            idempotencyKey,
            expiresAt: new Date(Date.now() + EXPIRATION_TIME_MS)
        });

        const savedBooking = await booking.save();

        // SMS service not available
        // Send SMS with landlord details
        // const smsResult = await smsService.sendBookingConfirmation(
        //     userPhone,
        //     house.landlord,
        //     house.contact,
        //     house.location,
        //     house.title
        // );

        // Update booking with SMS status
        // if (smsResult.success) {
        //     savedBooking.smsSent = true;
        //     savedBooking.smsMessage = smsResult.message;
        //     await savedBooking.save();
        // }

        console.log(`✅ Booking created: ${savedBooking._id}`);
        console.log(`📱 SMS Status: Not available`);

        // Calculate time remaining
        const expirationTime = savedBooking.expiresAt - new Date();
        const hoursRemaining = Math.floor(expirationTime / (1000 * 60 * 60));

        res.status(201).json({
            success: true,
            message: 'Booking confirmed successfully',
            booking: {
                id: savedBooking._id,
                houseId: house._id,
                houseName: house.title,
                location: house.location,
                landlord: house.landlord,
                landlordPhone: house.contact,
                smsStatus: 'pending',
                expiresAt: savedBooking.expiresAt,
                hoursUntilExpiration: hoursRemaining,
                confirmationMessage: `✅ Booking confirmed! Your landlord will contact you via ${userPhone}. Your booking access expires in ${hoursRemaining} hours.`,
                expirationWarning: `⏰ IMPORTANT: Your access to contact the landlord will expire in ${hoursRemaining} hours. Contact them soon!`
            }
        });
    } catch (error) {
        console.error('Booking creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating booking',
            error: error.message
        });
    }
});

/**
 * Get user bookings
 * @route GET /api/bookings/user/:email
 */
router.get('/user/:email', async (req, res) => {
    try {
        const bookings = await Booking.find({
            userEmail: req.params.email.toLowerCase()
        })
            .populate('houseId', 'title location price landlord contact')
            .sort({ createdAt: -1 });

        // Separate active and expired bookings
        const now = new Date();
        const active = bookings.filter(b => b.expiresAt > now);
        const expired = bookings.filter(b => b.expiresAt <= now);

        res.json({
            success: true,
            active: active,
            expired: expired,
            total: bookings.length
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching bookings',
            error: error.message
        });
    }
});

/**
 * Get single booking
 * @route GET /api/bookings/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('houseId');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check if expired
        const isExpired = booking.expiresAt <= new Date();

        // Determine requester role (if token provided)
        let requester = null;
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (token) {requester = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');}
        } catch (err) {
            requester = null;
        }

        // Build response depending on requester privileges
        if (requester && requester.role === 'admin') {
            return res.json({
                success: true,
                booking: {
                    ...booking.toObject(),
                    isExpired: isExpired,
                    timeRemaining: isExpired ? 0 : booking.expiresAt - new Date()
                }
            });
        }

        // If requester is the booking owner (by email) allow full view
        if (requester && requester.role === 'student' && String(requester.email).toLowerCase() === String(booking.userEmail).toLowerCase()) {
            return res.json({
                success: true,
                booking: {
                    ...booking.toObject(),
                    isExpired: isExpired,
                    timeRemaining: isExpired ? 0 : booking.expiresAt - new Date()
                }
            });
        }

        // If requester is landlord who owns the house, return anonymized booking (no PII)
        if (requester && requester.role === 'landlord' && booking.houseId && String(booking.houseId.landlord) === String(requester.id)) {
            return res.json({
                success: true,
                booking: {
                    id: booking._id,
                    houseId: booking.houseId._id,
                    houseName: booking.houseId.title,
                    status: booking.status,
                    isExpired: isExpired,
                    bookedAt: booking.createdAt,
                    expiresAt: booking.expiresAt,
                    bookingCode: booking.bookingCode || null
                }
            });
        }

        // Default: anonymized view for public/other roles
        return res.json({
            success: true,
            booking: {
                id: booking._id,
                houseId: booking.houseId?._id || booking.houseId,
                houseName: booking.houseId?.title || null,
                status: booking.status,
                isExpired: isExpired,
                bookedAt: booking.createdAt,
                expiresAt: booking.expiresAt,
                bookingCode: booking.bookingCode || null
            }
        });
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching booking',
            error: error.message
        });
    }
});

/**
 * Check booking status (useful for frontend)
 * @route POST /api/bookings/check-status
 * @param {string} houseId - House ID
 * @param {string} userEmail - User email
 */
router.post('/check-status', async (req, res) => {
    try {
        const { houseId, userEmail } = req.body;

        // Validate input
        if (!houseId || !userEmail) {
            return res.json({
                success: true,
                hasBooking: false,
                reason: 'Missing houseId or userEmail'
            });
        }

        const booking = await Booking.findOne({
            houseId: String(houseId),
            userEmail: String(userEmail).toLowerCase(),
            status: { $ne: 'cancelled' }
        });

        if (!booking) {
            return res.json({
                success: true,
                hasBooking: false
            });
        }

        const now = new Date();
        const isExpired = booking.expiresAt <= now;

        // Auto-update status to expired if past expiration time
        if (isExpired && booking.status !== 'expired') {
            booking.status = 'expired';
            await booking.save();
        }

        const timeRemaining = isExpired ? 0 : booking.expiresAt - now;
        const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

        res.json({
            success: true,
            hasBooking: !isExpired,
            booking: {
                id: booking._id,
                status: booking.status,
                isExpired: isExpired,
                expiresAt: booking.expiresAt,
                timeRemaining: timeRemaining,
                formattedTimeRemaining: isExpired 
                    ? '❌ Access Expired' 
                    : `⏰ ${hoursRemaining}h ${minutesRemaining}m remaining`,
                expirationMessage: isExpired 
                    ? 'Your access to view landlord details has expired. Please make a new booking to continue.' 
                    : 'Your access is valid. Hurry and contact the landlord before it expires!'
            }
        });
    } catch (error) {
        console.error('Error checking booking status:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking booking status',
            error: error.message
        });
    }
});

/**
 * Cancel booking
 * @route PATCH /api/bookings/:id/cancel
 */
router.patch('/:id/cancel', async (req, res) => {
    try {
        const booking = await Booking.findByIdAndUpdate(
            req.params.id,
            { status: 'cancelled' },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        res.json({
            success: true,
            message: 'Booking cancelled successfully',
            booking
        });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling booking',
            error: error.message
        });
    }
});

/**
 * Get all bookings for a house (admin)
 * @route GET /api/bookings/house/:houseId
 */
/**
 * Extend booking access (if user needs more time)
 * @route POST /api/bookings/:id/extend
 * @param {number} hoursToAdd - Number of hours to extend (default: 24)
 */
router.post('/:id/extend', async (req, res) => {
    try {
        const { hoursToAdd = 24 } = req.body;

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot extend cancelled bookings'
            });
        }

        const oldExpiration = booking.expiresAt;
        const extensionTime = hoursToAdd * 60 * 60 * 1000;
        booking.expiresAt = new Date(booking.expiresAt.getTime() + extensionTime);
        booking.status = 'confirmed'; // Reset status if was expired

        await booking.save();

        res.json({
            success: true,
            message: `✅ Booking access extended by ${hoursToAdd} hours`,
            booking: {
                id: booking._id,
                oldExpiration: oldExpiration,
                newExpiration: booking.expiresAt,
                extendedByHours: hoursToAdd,
                confirmationMessage: `Your access has been extended until ${booking.expiresAt.toLocaleString()}`
            }
        });
    } catch (error) {
        console.error('Error extending booking:', error);
        res.status(500).json({
            success: false,
            message: 'Error extending booking',
            error: error.message
        });
    }
});

/**
 * Get detailed expiration status for a booking
 * @route GET /api/bookings/:id/expiration-status
 */
router.get('/:id/expiration-status', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const now = new Date();
        const isExpired = booking.expiresAt <= now;
        const timeRemaining = isExpired ? 0 : booking.expiresAt - now;
        const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const secondsRemaining = Math.floor((timeRemaining % (1000 * 60)) / 1000);

        res.json({
            success: true,
            booking: {
                id: booking._id,
                status: booking.status,
                isExpired: isExpired,
                expiresAt: booking.expiresAt,
                bookedAt: booking.bookingDate,
                hoursRemaining,
                minutesRemaining,
                secondsRemaining,
                formattedTimeRemaining: isExpired 
                    ? '❌ EXPIRED' 
                    : `⏰ ${hoursRemaining}h ${minutesRemaining}m ${secondsRemaining}s`,
                expirationStatus: isExpired ? 'expired' : 'active',
                message: isExpired
                    ? '❌ Your booking access has expired. You need to make a new booking to access landlord details.'
                    : `✅ Your booking is active. Access expires in ${hoursRemaining} hours and ${minutesRemaining} minutes.`
            }
        });
    } catch (error) {
        console.error('Error fetching expiration status:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching expiration status',
            error: error.message
        });
    }
});

/**
 * Get all bookings for a house (admin)
 * @route GET /api/bookings/house/:houseId
 */
router.get('/house/:houseId', async (req, res) => {
    try {
        const bookings = await Booking.find({ houseId: req.params.houseId })
            .sort({ createdAt: -1 });

        // Determine requester role (if token provided)
        let requester = null;
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (token) {
                requester = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            }
        } catch (err) {
            requester = null; // invalid token -> treat as anonymous
        }

        const house = await House.findById(req.params.houseId).lean();

        const bookingsWithStatus = bookings.map(b => {
            const base = {
                id: b._id,
                houseId: b.houseId,
                status: b.status,
                isExpired: b.expiresAt <= new Date(),
                bookedAt: b.createdAt,
                expiresAt: b.expiresAt,
                bookingCode: b.bookingCode || null,
                amount: b.amount || null
            };

            // If requester is landlord who owns this house, or anonymous frontend caller,
            // DO NOT include personally identifying fields (userEmail, userName, userPhone).
            if (requester && requester.role === 'admin') {
                // Admins may see full booking details
                return {
                    ...b.toObject(),
                    isExpired: b.expiresAt <= new Date()
                };
            }

            // Landlords should not see PII about who booked; provide anonymized record
            if (requester && requester.role === 'landlord' && house && String(house.landlord) === String(requester.id)) {
                return base; // anonymized
            }

            // Default: anonymized view for public/other roles
            return base;
        });

        res.json({
            success: true,
            bookings: bookingsWithStatus,
            total: bookings.length
        });
    } catch (error) {
        console.error('Error fetching house bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching bookings',
            error: error.message
        });
    }
});

module.exports = router;
