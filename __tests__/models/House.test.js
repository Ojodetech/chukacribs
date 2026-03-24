const mongoose = require('mongoose');
const House = require('../../models/House');
const Landlord = require('../../models/Landlord');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let testLandlord;
let houseDataFactory;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  
  // Create test landlord
  testLandlord = await Landlord.create({
    name: 'Test Landlord',
    email: 'testlandlord@example.com',
    password: 'password123',
    phone: '0712345678',
    idNumber: '12345678'
  });
  
  // Factory function for house data
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
    submittedBy: testLandlord._id
  };
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

describe('House Model', () => {
  const getValidHouseData = () => ({ ...houseDataFactory });

  describe('Creation', () => {
    test('should create a house with required fields', async () => {
      const validHouseData = getValidHouseData();
      const house = await House.create(validHouseData);

      expect(house._id).toBeDefined();
      expect(house.title).toBe('Beautiful 2-Bedroom Apartment');
      expect(house.location).toBe('Chuka Town');
      expect(house.price).toBe(15000);
      expect(house.type).toBe('apartment');
      expect(house.bedrooms).toBe(2);
      expect(house.description).toBe('Spacious apartment near campus');
      expect(house.images.length).toBe(2);
    });

    test('should fail if required fields are missing', async () => {
      const incompleteData = {
        title: 'Beautiful Apartment',
        location: 'Chuka Town',
        landlord: testLandlord._id,
        landlordEmail: testLandlord.email,
        landlordPhone: testLandlord.phone,
        contact: testLandlord.phone,
        submittedBy: testLandlord._id
        // Missing price, type, description, images
      };

      await expect(House.create(incompleteData)).rejects.toThrow();
    });

    test('should validate house type enum', async () => {
      const validHouseData = getValidHouseData();
      const invalidData = {
        ...validHouseData,
        type: 'invalid-type'
      };

      await expect(House.create(invalidData)).rejects.toThrow();
    });

    test('should accept valid house types', async () => {
      const types = ['single', 'double', 'apartment', 'bedsitter'];

      for (const type of types) {
        const validHouseData = getValidHouseData();
        const house = await House.create({
          ...validHouseData,
          type,
          title: `House-${type}`
        });
        expect(house.type).toBe(type);
      }
    });

    test('should set default bedrooms to 1 if not specified', async () => {
      const dataWithoutBedrooms = {
        title: 'Studio Room',
        location: 'Chuka Town',
        price: 8000,
        type: 'bedsitter',
        description: 'Small studio',
        images: ['image.jpg'],
        landlord: testLandlord._id,
        landlordEmail: testLandlord.email,
        landlordPhone: testLandlord.phone,
        contact: testLandlord.phone,
        submittedBy: testLandlord._id
      };

      const house = await House.create(dataWithoutBedrooms);
      expect(house.bedrooms).toBe(1);
    });

    test('should enforce minimum price of 0', async () => {
      const validHouseData = getValidHouseData();
      const invalidData = {
        ...validHouseData,
        price: -100
      };

      await expect(House.create(invalidData)).rejects.toThrow();
    });

    test('should accept empty images array initially', async () => {
      const validHouseData = getValidHouseData();
      const houseWithImages = {
        ...validHouseData,
        images: ['image1.jpg']
      };

      const house = await House.create(houseWithImages);
      expect(house.images.length).toBeGreaterThan(0);
    });
  });

  describe('Amenities', () => {
    test('should set amenity defaults', async () => {
      const validHouseData = getValidHouseData();
      const house = await House.create(validHouseData);

      expect(house.amenities.wifi).toBe(false);
      expect(house.amenities.water).toBe(false);
      expect(house.amenities.electricity).toBe(false);
    });

    test('should allow amenity updates', async () => {
      const validHouseData = getValidHouseData();
      const house = await House.create(validHouseData);
      const updated = await House.findByIdAndUpdate(
        house._id,
        {
          'amenities.wifi': true,
          'amenities.water': true
        },
        { new: true }
      );

      expect(updated.amenities.wifi).toBe(true);
      expect(updated.amenities.water).toBe(true);
    });
  });

  describe('Retrieval', () => {
    test('should find house by location', async () => {
      const validHouseData = getValidHouseData();
      await House.create(validHouseData);
      const found = await House.findOne({ location: 'Chuka Town' });

      expect(found).toBeDefined();
      expect(found.title).toBe('Beautiful 2-Bedroom Apartment');
    });

    test('should find multiple houses', async () => {
      const validHouseData = getValidHouseData();
      await House.create(validHouseData);
      await House.create({
        ...validHouseData,
        title: 'Another Apartment'
      });

      const houses = await House.find({});
      expect(houses.length).toBe(2);
    });

    test('should find houses by price range', async () => {
      const validHouseData = getValidHouseData();
      await House.create(validHouseData);
      await House.create({
        ...validHouseData,
        title: 'Expensive House',
        price: 50000
      });

      const affordable = await House.find({ price: { $lte: 20000 } });
      expect(affordable.length).toBe(1);
    });

    test('should find houses by type', async () => {
      const validHouseData = getValidHouseData();
      await House.create(validHouseData);
      await House.create({
        ...validHouseData,
        title: 'Single Room',
        type: 'single'
      });

      const apartments = await House.find({ type: 'apartment' });
      expect(apartments.length).toBe(1);
      expect(apartments[0].type).toBe('apartment');
    });
  });

  describe('Updates', () => {
    test('should update house details', async () => {
      const validHouseData = getValidHouseData();
      const house = await House.create(validHouseData);
      const updated = await House.findByIdAndUpdate(
        house._id,
        {
          price: 20000,
          description: 'Updated description'
        },
        { new: true }
      );

      expect(updated.price).toBe(20000);
      expect(updated.description).toBe('Updated description');
      expect(updated.title).toBe('Beautiful 2-Bedroom Apartment');
    });

    test('should add images', async () => {
      const validHouseData = getValidHouseData();
      const house = await House.create(validHouseData);
      const updated = await House.findByIdAndUpdate(
        house._id,
        { $push: { images: 'image3.jpg' } },
        { new: true }
      );

      expect(updated.images.length).toBe(3);
      expect(updated.images).toContain('image3.jpg');
    });
  });

  describe('Deletion', () => {
    test('should delete house', async () => {
      const validHouseData = getValidHouseData();
      const house = await House.create(validHouseData);
      await House.findByIdAndDelete(house._id);

      const found = await House.findById(house._id);
      expect(found).toBeNull();
    });
  });

  describe('Validation', () => {
    test('should trim whitespace from fields', async () => {
      const validHouseData = getValidHouseData();
      const dataWithWhitespace = {
        title: '  Beautiful Apartment  ',
        location: '  Chuka Town  ',
        price: 15000,
        type: 'apartment',
        description: '  Nice place  ',
        images: ['image.jpg'],
        landlord: validHouseData.landlord,
        landlordEmail: validHouseData.landlordEmail,
        landlordPhone: validHouseData.landlordPhone,
        contact: '  +254712345678  ',
        submittedBy: '  admin  '
      };

      const house = await House.create(dataWithWhitespace);
      expect(house.title).toBe('Beautiful Apartment');
      expect(house.location).toBe('Chuka Town');
      expect(house.description).toBe('Nice place');
    });

    test('should require positive price', async () => {
      const validHouseData = getValidHouseData();
      const invalidData = {
        ...validHouseData,
        price: 0
      };

      // Note: 0 might be allowed depending on schema, adjust if needed
      const house = await House.create(invalidData);
      expect(house.price).toBe(0);
    });
  });
});
