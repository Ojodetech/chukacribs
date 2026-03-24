const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../config/logger');
const { sendEmail } = require('../config/email');
const Subscription = require('../models/Subscription');

const router = express.Router();

// Public endpoint for coming-soon email signups
router.post('/',
  body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;
    try {
      // persist to database
      await Subscription.findOneAndUpdate(
        { email },
        { email },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const adminEmail = process.env.ADMIN_EMAIL || 'admin@chukacribs.co.ke';
      const adminHtml = `<p>New coming-soon signup: <strong>${email}</strong></p>`;
      await sendEmail({
        to: adminEmail,
        subject: 'New Coming Soon Subscription',
        html: adminHtml
      });

      // send confirmation to subscriber
      const userHtml = `
        <p>Thanks for signing up for ChukaCribs!</p>
        <p>We&rsquo;ll notify you once we launch.</p>
      `;
      await sendEmail({
        to: email,
        subject: 'You&rsquo;re on the list – ChukaCribs coming soon',
        html: userHtml
      });

      res.json({ success: true, message: 'Subscription received' });
    } catch (err) {
      logger.error('subscribe error', err);
      res.status(500).json({ success: false, message: 'Failed to subscribe' });
    }
  }
);

module.exports = router;
