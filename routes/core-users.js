const express = require('express');
const router = express.Router();
const User = require('../models/User');

/**
 * ➕ CREATE USER
 * POST /core/user
 */
router.post('/user', async (req, res) => {
    try {
        const { name, phone, email, role } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ error: 'name and phone required' });
        }

        const user = await User.create({
            name,
            phone,
            email,
            role: role || 'tenant'
        });

        res.status(201).json({
            success: true,
            message: 'User created',
            user
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Phone number already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

/**
 * 🔍 GET USER BY ID
 * GET /core/user/:id
 */
router.get('/user/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 🔍 GET USER BY PHONE
 * GET /core/user/phone/:phone
 */
router.get('/user/phone/:phone', async (req, res) => {
    try {
        const user = await User.findOne({ phone: req.params.phone });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 📋 LIST ALL USERS
 * GET /core/users
 */
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });

        res.json({
            total: users.length,
            tenants: users.filter(u => u.role === 'tenant').length,
            admins: users.filter(u => u.role === 'admin').length,
            users
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * ✏️ UPDATE USER
 * PATCH /core/user/:id
 */
router.patch('/user/:id', async (req, res) => {
    try {
        const { name, email, role } = req.body;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            {
                ...(name && { name }),
                ...(email && { email }),
                ...(role && { role })
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            message: 'User updated',
            user
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 🗑️ DELETE USER
 * DELETE /core/user/:id
 */
router.delete('/user/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            message: 'User deleted'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
