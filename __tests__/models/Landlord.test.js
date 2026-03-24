const mongoose = require('mongoose');
const Landlord = require('../../models/Landlord');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup and teardown
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer && typeof mongoServer.stop === 'function') {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  // Clear collections before each test
  await Landlord.deleteMany({});
});

describe('Landlord Model', () => {
  describe('Creation', () => {
    test('should create a landlord with all required fields', async () => {
      const landlordData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword123',
        phone: '+254712345678',
        idNumber: 'ID123456'
      };

      const landlord = await Landlord.create(landlordData);

      expect(landlord._id).toBeDefined();
      expect(landlord.name).toBe('John Doe');
      expect(landlord.email).toBe('john@example.com');
      expect(landlord.phone).toBe('+254712345678');
      expect(landlord.verified).toBe(false);
      expect(landlord.emailVerified).toBe(false);
    });

    test('should fail if required fields are missing', async () => {
      const incompleteData = {
        name: 'Jane Doe',
        email: 'jane@example.com'
        // Missing password, phone, idNumber
      };

      await expect(Landlord.create(incompleteData)).rejects.toThrow();
    });

    test('should enforce unique email', async () => {
      const landlordData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword123',
        phone: '+254712345678',
        idNumber: 'ID123456'
      };

      await Landlord.create(landlordData);

      const duplicateData = {
        name: 'Jane Doe',
        email: 'john@example.com',
        password: 'hashedPassword456',
        phone: '+254787654321',
        idNumber: 'ID654321'
      };

      await expect(Landlord.create(duplicateData)).rejects.toThrow();
    });

    test('should enforce unique idNumber', async () => {
      const landlordData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword123',
        phone: '+254712345678',
        idNumber: 'ID123456'
      };

      await Landlord.create(landlordData);

      const duplicateData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'hashedPassword456',
        phone: '+254787654321',
        idNumber: 'ID123456'
      };

      await expect(Landlord.create(duplicateData)).rejects.toThrow();
    });

    test('should validate email format', async () => {
      const invalidData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'hashedPassword123',
        phone: '+254712345678',
        idNumber: 'ID123456'
      };

      await expect(Landlord.create(invalidData)).rejects.toThrow();
    });
  });

  describe('Retrieval', () => {
    test('should find landlord by email', async () => {
      const landlordData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword123',
        phone: '+254712345678',
        idNumber: 'ID123456'
      };

      await Landlord.create(landlordData);
      const found = await Landlord.findOne({ email: 'john@example.com' });

      expect(found).toBeDefined();
      expect(found.name).toBe('John Doe');
    });

    test('should find landlord by ID', async () => {
      const landlordData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword123',
        phone: '+254712345678',
        idNumber: 'ID123456'
      };

      const created = await Landlord.create(landlordData);
      const found = await Landlord.findById(created._id);

      expect(found).toBeDefined();
      expect(found.email).toBe('john@example.com');
    });

    test('should return null when landlord not found', async () => {
      const found = await Landlord.findOne({ email: 'nonexistent@example.com' });
      expect(found).toBeNull();
    });
  });

  describe('Updates', () => {
    test('should update landlord name', async () => {
      const landlordData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword123',
        phone: '+254712345678',
        idNumber: 'ID123456'
      };

      const created = await Landlord.create(landlordData);
      const updated = await Landlord.findByIdAndUpdate(
        created._id,
        { name: 'Jane Doe' },
        { new: true }
      );

      expect(updated.name).toBe('Jane Doe');
      expect(updated.email).toBe('john@example.com');
    });

    test('should update verified status', async () => {
      const landlordData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword123',
        phone: '+254712345678',
        idNumber: 'ID123456'
      };

      const created = await Landlord.create(landlordData);
      const updated = await Landlord.findByIdAndUpdate(
        created._id,
        { verified: true },
        { new: true }
      );

      expect(updated.verified).toBe(true);
    });
  });

  describe('Deletion', () => {
    test('should delete landlord', async () => {
      const landlordData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword123',
        phone: '+254712345678',
        idNumber: 'ID123456'
      };

      const created = await Landlord.create(landlordData);
      await Landlord.findByIdAndDelete(created._id);

      const found = await Landlord.findById(created._id);
      expect(found).toBeNull();
    });
  });

  describe('Validation', () => {
    test('should trim whitespace from fields', async () => {
      const landlordData = {
        name: '  John Doe  ',
        email: '  john@example.com  ',
        password: 'hashedPassword123',
        phone: '  +254712345678  ',
        idNumber: '  ID123456  '
      };

      const created = await Landlord.create(landlordData);

      expect(created.name).toBe('John Doe');
      expect(created.email).toBe('john@example.com');
      expect(created.phone).toBe('+254712345678');
    });

    test('should convert email to lowercase', async () => {
      const landlordData = {
        name: 'John Doe',
        email: 'JOHN@EXAMPLE.COM',
        password: 'hashedPassword123',
        phone: '+254712345678',
        idNumber: 'ID123456'
      };

      const created = await Landlord.create(landlordData);
      expect(created.email).toBe('john@example.com');
    });
  });
});
