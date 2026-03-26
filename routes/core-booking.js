const express = require('express');
const router = express.Router();
const CoreBooking = require('../models/CoreBooking');
const Room = require('../models/Room');
const User = require('../models/User');
const CorePayment = require('../models/CorePayment');

/**
 * 🏠 CREATE BOOKING ENDPOINT
 * POST /core/book
 */
router.post('/book', async (req, res) => {
    try {
        const { userId, roomId } = req.body;

        if (!userId || !roomId) {
            return res.status(400).json({ error: 'userId and roomId required' });
        }

        // Check if room exists
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        // Check if room is already occupied
        if (room.isOccupied) {
            return res.status(400).json({ error: 'Room already taken' });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create booking
        const booking = await CoreBooking.create({
            user: userId,
            room: roomId,
            status: 'PENDING'
        });

        const populatedBooking = await booking.populate(['user', 'room']);

        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            booking: populatedBooking
        });
    } catch (err) {
        console.error('Booking creation error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * 🔍 GET BOOKING BY ID
 * GET /core/booking/:id
 */
router.get('/booking/:id', async (req, res) => {
    try {
        const booking = await CoreBooking.findById(req.params.id).populate(['user', 'room']);

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json(booking);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 📋 LIST ALL BOOKINGS
 * GET /core/bookings
 */
router.get('/bookings', async (req, res) => {
    try {
        const bookings = await CoreBooking.find()
            .populate(['user', 'room'])
            .sort({ createdAt: -1 });

        res.json({
            total: bookings.length,
            bookings
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * ✏️ UPDATE BOOKING STATUS
 * PATCH /core/booking/:id/status
 */
router.patch('/booking/:id/status', async (req, res) => {
    try {
        const { status } = req.body;

        if (!['PENDING', 'PAID', 'CANCELLED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const booking = await CoreBooking.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).populate(['user', 'room']);

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json({
            success: true,
            message: 'Booking updated',
            booking
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
