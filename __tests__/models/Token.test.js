process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '6.0.9';

jest.setTimeout(300000); // allow longer start time for MongoDB binaries on slow CI / Windows

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Token = require('../../models/Token');

describe('Token model and reservation lock', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer && typeof mongoServer.stop === 'function') {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await Token.deleteMany({});
  });

  test('reserveToken should lock an unused valid token', async () => {
    const tokenStr = 'TEST-TOKEN-LOCK';
    const doc = await Token.create({
      token: tokenStr,
      phoneNumber: '0712345678',
      amount: 100,
      expiresAt: new Date(Date.now() + 10 * 60000)
    });

    const reserved = await Token.reserveToken(tokenStr);
    expect(reserved).not.toBeNull();
    expect(reserved.token).toBe(tokenStr);
    expect(reserved.isLocked).toBe(true);
    expect(reserved.lockExpiresAt).toBeInstanceOf(Date);
  });

  test('reserveToken should fail for already locked token', async () => {
    const tokenStr = 'LOCKED-TOKEN';
    await Token.create({
      token: tokenStr,
      phoneNumber: '0712345678',
      amount: 100,
      isLocked: true,
      lockExpiresAt: new Date(Date.now() + 2 * 60000),
      expiresAt: new Date(Date.now() + 10 * 60000)
    });

    const reserved = await Token.reserveToken(tokenStr);
    expect(reserved).toBeNull();
  });

  test('reserveToken should fail for expired token', async () => {
    const tokenStr = 'EXPIRED-TOKEN';
    await Token.create({
      token: tokenStr,
      phoneNumber: '0712345678',
      amount: 100,
      expiresAt: new Date(Date.now() - 1000) // already expired
    });

    const reserved = await Token.reserveToken(tokenStr);
    expect(reserved).toBeNull();
  });

  test('reserveToken should fail for already used token', async () => {
    const tokenStr = 'USED-TOKEN';
    await Token.create({
      token: tokenStr,
      phoneNumber: '0712345678',
      amount: 100,
      isUsed: true,
      expiresAt: new Date(Date.now() + 10 * 60000)
    });

    const reserved = await Token.reserveToken(tokenStr);
    expect(reserved).toBeNull();
  });
});