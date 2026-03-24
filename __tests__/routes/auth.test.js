const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Landlord = require('../../models/Landlord');

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Disconnect existing connection if any
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  await mongoose.connect(mongoUri);
  
  // Load app AFTER database is connected
  app = require('../../index');
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer && typeof mongoServer.stop === 'function') {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Landlord.deleteMany({});
});

describe('Authentication Routes', () => {
  const landlordData = {
    name: 'Test Landlord',
    email: 'test@example.com',
    password: 'password123',
    phone: '+254712345678',
    idNumber: 'ID123456'
  };

  describe('Landlord Registration', () => {
    test('should register a new landlord', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(landlordData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.landlord).toBeDefined();
      expect(response.body.landlord.email).toBe('test@example.com');
    });

    test('should reject registration with missing fields', async () => {
      const incompleteData = {
        name: 'Test Landlord',
        email: 'test@example.com'
        // Missing password, phone, idNumber
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should reject duplicate email', async () => {
      // Create first landlord
      await request(app)
        .post('/api/auth/register')
        .send(landlordData);

      // Try to create with same email
      const duplicateData = {
        ...landlordData,
        name: 'Another Landlord'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    test('should reject invalid email format', async () => {
      const invalidData = {
        ...landlordData,
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
    });
  });

  describe('Landlord Login', () => {
    beforeEach(async () => {
      // Create a landlord for login tests
      await Landlord.create({
        ...landlordData
      });
    });

    test('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.headers['set-cookie']).toBeDefined();
    });

    test('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should set secure cookie on successful login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('authToken');
      expect(cookies[0]).toContain('HttpOnly');
    });
  });

  describe('Landlord Profile', () => {
    let token;

    beforeEach(async () => {
      const landlord = await Landlord.create({
        ...landlordData
      });

      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      token = loginResponse.body.token;
    });

    test('should get profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('test@example.com');
      expect(response.body.name).toBe('Test Landlord');
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
    });

    test('should update profile with valid token', async () => {
      const response = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Name',
          phone: '+254787654321'
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.phone).toBe('+254787654321');
    });
  });

  describe('Authentication Error Handling', () => {
    test('should handle missing required fields gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
    });

    test('should handle invalid JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });
  });
});
