const express = require('express');
const router = express.Router();
const CorePayment = require('../models/CorePayment');
const CoreBooking = require('../models/CoreBooking');
const Room = require('../models/Room');
const { initiateSTKPush } = require('../config/mpesa');

/**
 * 💳 INITIATE STK PUSH PAYMENT
 * POST /core/pay
 */
router.post('/pay', async (req, res) => {
    try {
        const { bookingId, phone } = req.body;

        if (!bookingId || !phone) {
            return res.status(400).json({ error: 'bookingId and phone required' });
        }

        // Get booking with room details
        const booking = await CoreBooking.findById(bookingId).populate('room');

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.status === 'PAID') {
            return res.status(400).json({ error: 'Booking already paid' });
        }

        const amount = booking.room.price;

        // Call STK Push API
        const stkResponse = await initiateSTKPush(phone, amount, bookingId);
        
        if (!stkResponse.success) {
            return res.status(400).json({ error: 'Failed to initiate payment', details: stkResponse });
        }

        const checkoutId = stkResponse.checkoutRequestId;

        // Create payment record
        const payment = await CorePayment.create({
            booking: bookingId,
            phone,
            amount,
            checkoutId,
            status: 'PENDING'
        });

        res.status(201).json({
            success: true,
            message: 'Payment initiated',
            payment,
            checkoutId
        });
    } catch (err) {
        console.error('Payment initiation error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * ✅ M-PESA CALLBACK ENDPOINT
 * POST /api/core/mpesa/callback
 */
router.post('/api/core/mpesa/callback', async (req, res) => {
    // Always respond immediately
    res.status(200).json({ ResultCode: 0 });

    try {
        const callback = req.body?.Body?.stkCallback;

        if (!callback) {
            console.log('No callback data');
            return;
        }

        const { ResultCode, CheckoutRequestID, CallbackMetadata } = callback;

        // Find payment by checkoutId
        const payment = await CorePayment.findOne({
            checkoutId: CheckoutRequestID
        }).populate('booking');

        if (!payment) {
            console.log('Payment not found:', CheckoutRequestID);
            return;
        }

        // FAILED PAYMENT
        if (ResultCode !== 0) {
            payment.status = 'FAILED';
            await payment.save();
            console.log('❌ Payment failed:', CheckoutRequestID);
            return;
        }

        // EXTRACT MPESA RECEIPT
        const items = CallbackMetadata?.Item || [];

        const getValue = (name) => {
            const item = items.find(i => i.Name === name);
            return item ? item.Value : null;
        };

        const receipt = getValue('MpesaReceiptNumber');
        const transactionDate = getValue('TransactionDate');

        /**
         * 🔥 UPDATE PAYMENT
         */
        payment.status = 'SUCCESS';
        payment.receipt = receipt;
        await payment.save();
        console.log('✅ Payment successful:', receipt);

        /**
         * 🔥 UPDATE BOOKING
         */
        const booking = await CoreBooking.findById(payment.booking);
        booking.status = 'PAID';
        await booking.save();
        console.log('✅ Booking marked as PAID');

        /**
         * 🔥 LOCK ROOM (CRITICAL)
         */
        await Room.findByIdAndUpdate(booking.room, {
            isOccupied: true
        });
        console.log('✅ Room locked');

        /**
         * 🔥 AUTOMATION TRIGGERS
         */
        // TODO: Send SMS confirmation
        // TODO: Send email receipt
        // TODO: Generate PDF receipt
        // TODO: Notify admin

    } catch (err) {
        console.error('Callback processing error:', err);
    }
});

/**
 * 🔍 GET PAYMENT BY ID
 * GET /core/payment/:id
 */
router.get('/payment/:id', async (req, res) => {
    try {
        const payment = await CorePayment.findById(req.params.id).populate('booking');

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        res.json(payment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 📋 GET PAYMENT BY RECEIPT
 * GET /core/payment/receipt/:receipt
 */
router.get('/payment/receipt/:receipt', async (req, res) => {
    try {
        const payment = await CorePayment.findOne({
            receipt: req.params.receipt
        }).populate('booking');

        if (!payment) {
            return res.status(404).json({ error: 'Receipt not found' });
        }

        res.json(payment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 📋 LIST ALL PAYMENTS
 * GET /core/payments
 */
router.get('/payments', async (req, res) => {
    try {
        const payments = await CorePayment.find()
            .populate('booking')
            .sort({ createdAt: -1 });

        res.json({
            total: payments.length,
            payments
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
