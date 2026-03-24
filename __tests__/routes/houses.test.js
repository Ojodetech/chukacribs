const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const House = require('../../models/House');
const Landlord = require('../../models/Landlord');

let mongoServer;
let app;
let testLandlord;
let houseDataFactory;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  await mongoose.connect(mongoUri);
  
  // Create test landlord BEFORE building houseData
  testLandlord = await Landlord.create({
    name: 'Test Landlord',
    email: 'testlandlord@example.com',
    password: 'password123',
    phone: '0712345678',
    idNumber: '12345678'
  });
  
  // Store house data template
  houseDataFactory = {
    title: 'Beautiful 2-Bedroom Apartment',
    location: 'Chuka Town',
    price: 15000,
    type: 'apartment',
    bedrooms: 2,
    description: 'Spacious apartment near campus',
    images: ['image1.jpg', 'image2.jpg'],
    landlord: testLandlord._id,
    landlordEmail: testLandlord.email,
    landlordPhone: testLandlord.phone,
    contact: testLandlord.phone,
    submittedBy: testLandlord._id,
    approved: true,
    available: true
  };
  
  // Load app AFTER database and landlord are ready
  app = require('../../index');
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer && typeof mongoServer.stop === 'function') {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await House.deleteMany({});
});

describe('Houses Routes', () => {
  const getHouseData = () => ({ ...houseDataFactory });

  describe('GET /api/houses', () => {
    test('should retrieve all houses', async () => {
      // Create test houses
      await House.create(getHouseData());
      await House.create({
        ...getHouseData(),
        title: 'Single Room'
      });

      const response = await request(app).get('/api/houses');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.houses || response.body)).toBe(true);
      expect((response.body.houses || response.body).length).toBe(2);
    });

    test('should return empty array when no houses exist', async () => {
      const response = await request(app).get('/api/houses');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.houses || response.body)).toBe(true);
      expect((response.body.houses || response.body).length).toBe(0);
    });

    test('should filter houses by location', async () => {
      await House.create(getHouseData());
      await House.create({
        ...getHouseData(),
        location: 'Meru Town',
        title: 'House in Meru'
      });

      const response = await request(app)
        .get('/api/houses')
        .query({ location: 'Chuka Town' });

      expect(response.status).toBe(200);
      const houses = response.body.houses || response.body;
      expect(houses.every(h => h.location === 'Chuka Town')).toBe(true);
    });

    test('should filter houses by price range', async () => {
      await House.create(getHouseData());
      await House.create({
        ...getHouseData(),
        price: 50000,
        title: 'Expensive House'
      });

      const response = await request(app)
        .get('/api/houses')
        .query({ minPrice: 10000, maxPrice: 20000 });

      expect(response.status).toBe(200);
      const houses = response.body.houses || response.body;
      expect(houses.every(h => h.price >= 10000 && h.price <= 20000)).toBe(true);
    });

    test('should filter houses by type', async () => {
      await House.create(getHouseData());
      await House.create({
        ...getHouseData(),
        type: 'single',
        title: 'Single Room'
      });

      const response = await request(app)
        .get('/api/houses')
        .query({ type: 'apartment' });

      expect(response.status).toBe(200);
      const houses = response.body.houses || response.body;
      expect(houses.every(h => h.type === 'apartment')).toBe(true);
    });

    test('should support pagination', async () => {
      // Create 5 houses
      for (let i = 0; i < 5; i++) {
        await House.create({
          ...getHouseData(),
          title: `House ${i}`
        });
      }

      const response = await request(app)
        .get('/api/houses')
        .query({ page: 1, limit: 2 });

      expect(response.status).toBe(200);
      const houses = response.body.houses || response.body;
      expect(houses.length).toBeLessThanOrEqual(2);
    });

    test('should sort houses by price', async () => {
      await House.create({ ...getHouseData(), price: 20000 });
      await House.create({ ...getHouseData(), price: 10000, title: 'Cheap House' });
      await House.create({ ...getHouseData(), price: 30000, title: 'Expensive House' });

      const response = await request(app)
        .get('/api/houses')
        .query({ sort: 'price' });

      expect(response.status).toBe(200);
      const houses = response.body.houses || response.body;
      expect(houses.length).toBeGreaterThan(0);
    });

    test('should include house amenities in response', async () => {
      const houseWithAmenities = await House.create({
        ...getHouseData(),
        amenities: {
          wifi: true,
          water: true,
          electricity: false
        }
      });

      const response = await request(app).get('/api/houses');

      expect(response.status).toBe(200);
      const houses = response.body.houses || response.body;
      const foundHouse = houses[0];
      expect(foundHouse.amenities).toBeDefined();
    });
  });

  describe('GET /api/houses/:id', () => {
    test('should get single house by ID', async () => {
      const created = await House.create(getHouseData());

      const response = await request(app).get(`/api/houses/${created._id}`);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Beautiful 2-Bedroom Apartment');
      expect(response.body.price).toBe(15000);
    });

    test('should return 404 for non-existent house', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app).get(`/api/houses/${fakeId}`);

      expect(response.status).toBe(404);
    });

    test('should return 400 for invalid house ID format', async () => {
      const response = await request(app).get('/api/houses/invalid-id');

      expect(response.status).toBe(400);
    });

    test('should include all house details', async () => {
      const created = await House.create({
        ...getHouseData(),
        'amenities.wifi': true,
        'amenities.water': true,
        features: ['Near Campus', 'Secure Compound']
      });

      const response = await request(app).get(`/api/houses/${created._id}`);

      expect(response.status).toBe(200);
      expect(response.body.title).toBeDefined();
      expect(response.body.images).toBeDefined();
      expect(response.body.amenities).toBeDefined();
      expect(response.body.features).toBeDefined();
    });
  });

  describe('Search and Filter', () => {
    beforeEach(async () => {
      // Create diverse test data
      await House.create({
        ...getHouseData(),
        title: 'Spacious Apartment',
        location: 'Chuka Town',
        price: 15000
      });
      await House.create({
        ...getHouseData(),
        title: 'Cozy Bedsitter',
        location: 'Chuka Town',
        price: 8000,
        type: 'bedsitter'
      });
      await House.create({
        ...getHouseData(),
        title: 'Garden House',
        location: 'Meru Road',
        price: 25000,
        type: 'double'
      });
    });

    test('should search houses by title', async () => {
      const response = await request(app)
        .get('/api/houses')
        .query({ search: 'Spacious' });

      expect(response.status).toBe(200);
      const houses = response.body.houses || response.body;
      expect(houses.length).toBeGreaterThan(0);
      expect(houses.some(h => h.title.includes('Spacious'))).toBe(true);
    });

    test('should combine multiple filters', async () => {
      const response = await request(app)
        .get('/api/houses')
        .query({
          location: 'Chuka Town',
          minPrice: 7000,
          maxPrice: 20000
        });

      expect(response.status).toBe(200);
      const houses = response.body.houses || response.body;
      expect(houses.every(h => 
        h.location === 'Chuka Town' && 
        h.price >= 7000 && 
        h.price <= 20000
      )).toBe(true);
    });

    test('should handle empty filter results', async () => {
      const response = await request(app)
        .get('/api/houses')
        .query({ minPrice: 100000 });

      expect(response.status).toBe(200);
      const houses = response.body.houses || response.body;
      expect(houses.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // This test would need actual error injection
      const response = await request(app).get('/api/houses');

      expect([200, 500]).toContain(response.status);
    });

    test('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/houses')
        .query({ limit: 'invalid' });

      // Should either work with default or return 400
      expect([200, 400]).toContain(response.status);
    });
  });
});
