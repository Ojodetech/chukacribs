const request = require('supertest');
const app = require('../../index'); // assuming index exports app for tests
const emailConfig = require('../../config/email');
const Subscription = require('../../models/Subscription');

describe('POST /api/subscribe', () => {
  beforeAll(async () => {
    // mock sendEmail to avoid actual network call
    jest.spyOn(emailConfig, 'sendEmail').mockResolvedValue({ success: true });
    // ensure DB connection and clear previous records
    await require('../../config/database')();
    await Subscription.deleteMany({});
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await Subscription.deleteMany({});

    // Ensure Mongoose connections are closed to avoid open-handle warnings
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('should accept valid email, store it, and return success', async () => {
    const res = await request(app)
      .post('/api/subscribe')
      .send({ email: 'test@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/subscription/i);

    const record = await Subscription.findOne({ email: 'test@example.com' });
    expect(record).not.toBeNull();
  });

  it('should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/subscribe')
      .send({ email: 'not-an-email' });

    expect(res.statusCode).toBe(422);
    expect(res.body.success).toBe(false);
  });
});
