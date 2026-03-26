const express = require('express');
const router = express.Router();
const Room = require('../models/Room');

/**
 * ➕ CREATE ROOM
 * POST /core/room
 */
router.post('/room', async (req, res) => {
    try {
        const { name, price, description, amenities } = req.body;

        if (!name || !price) {
            return res.status(400).json({ error: 'name and price required' });
        }

        const room = await Room.create({
            name,
            price,
            description,
            amenities: amenities || []
        });

        res.status(201).json({
            success: true,
            message: 'Room created',
            room
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 🔍 GET ROOM BY ID
 * GET /core/room/:id
 */
router.get('/room/:id', async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json(room);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 📋 LIST ALL ROOMS
 * GET /core/rooms
 */
router.get('/rooms', async (req, res) => {
    try {
        const rooms = await Room.find().sort({ createdAt: -1 });

        res.json({
            total: rooms.length,
            available: rooms.filter(r => !r.isOccupied).length,
            occupied: rooms.filter(r => r.isOccupied).length,
            rooms
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 📋 LIST AVAILABLE ROOMS
 * GET /core/rooms/available
 */
router.get('/rooms/available', async (req, res) => {
    try {
        const rooms = await Room.find({ isOccupied: false }).sort({ createdAt: -1 });

        res.json({
            total: rooms.length,
            rooms
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * ✏️ UPDATE ROOM
 * PATCH /core/room/:id
 */
router.patch('/room/:id', async (req, res) => {
    try {
        const { name, price, description, amenities } = req.body;

        const room = await Room.findByIdAndUpdate(
            req.params.id,
            {
                ...(name && { name }),
                ...(price !== undefined && { price }),
                ...(description && { description }),
                ...(amenities && { amenities })
            },
            { new: true }
        );

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json({
            success: true,
            message: 'Room updated',
            room
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 🗑️ DELETE ROOM
 * DELETE /core/room/:id
 */
router.delete('/room/:id', async (req, res) => {
    try {
        const room = await Room.findByIdAndDelete(req.params.id);

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json({
            success: true,
            message: 'Room deleted'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
