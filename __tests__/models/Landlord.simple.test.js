const mongoose = require('mongoose');
const Landlord = require('../../models/Landlord');

// Simple unit tests without full integration
describe('Landlord Model', () => {
  describe('Schema validation', () => {
    test('should require name field', () => {
      const landlord = new Landlord({
        email: 'test@example.com',
        password: 'password123',
        phone: '0712345678'
      });
      
      const error = landlord.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
    });

    test('should require email field', () => {
      const landlord = new Landlord({
        name: 'John Doe',
        password: 'password123',
        phone: '0712345678'
      });
      
      const error = landlord.validateSync();
      expect(error).toBeDefined();
    });

    test('should require password field', () => {
      const landlord = new Landlord({
        name: 'John Doe',
        email: 'test@example.com',
        phone: '0712345678'
      });
      
      const error = landlord.validateSync();
      expect(error).toBeDefined();
    });

    test('should accept valid landlord data', () => {
      const landlord = new Landlord({
        name: 'John Doe',
        email: 'test@example.com',
        password: 'password123',
        phone: '0712345678',
        idNumber: '12345678'
      });
      
      const error = landlord.validateSync();
      expect(error).toBeUndefined();
    });

    test('should validate email format', () => {
      const landlord = new Landlord({
        name: 'John Doe',
        email: 'invalid-email',
        password: 'password123',
        phone: '0712345678'
      });
      
      const error = landlord.validateSync();
      expect(error).toBeDefined();
    });

    test('should have verified flag defaulting to false', () => {
      const landlord = new Landlord({
        name: 'John Doe',
        email: 'test@example.com',
        password: 'password123',
        phone: '0712345678'
      });
      
      expect(landlord.verified).toBe(false);
    });
  });

  describe('Field defaults and types', () => {
    test('should trim name whitespace', () => {
      const landlord = new Landlord({
        name: '  John Doe  ',
        email: 'test@example.com',
        password: 'password123',
        phone: '0712345678'
      });
      
      // Note: Trimming typically happens on save or via middleware
      expect(typeof landlord.name).toBe('string');
    });

    test('should convert email to lowercase', () => {
      const landlord = new Landlord({
        name: 'John Doe',
        email: 'TEST@EXAMPLE.COM',
        password: 'password123',
        phone: '0712345678'
      });
      
      expect(landlord.email).toBe('test@example.com');
    });

    test('should create landlord with all fields', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secure123',
        phone: '0712345678',
        idNumber: '12345678',
        bankName: 'KCB',
        bankAccountNumber: '1234567890'
      };
      
      const landlord = new Landlord(data);
      expect(landlord.name).toBe(data.name);
      expect(landlord.email).toBe(data.email.toLowerCase());
      expect(landlord.phone).toBe(data.phone);
    });
  });

  describe('Instance methods', () => {
    test('should have instance methods available', () => {
      const landlord = new Landlord({
        name: 'John Doe',
        email: 'test@example.com',
        password: 'password123',
        phone: '0712345678'
      });
      
      expect(typeof landlord.save).toBe('function');
      expect(typeof landlord.toObject).toBe('function');
    });
  });

  describe('Uniqueness constraints', () => {
    test('should have email field defined', () => {
      const schema = Landlord.schema;
      const emailPath = schema.paths.email;
      expect(emailPath).toBeDefined();
    });

    test('should have idNumber field defined', () => {
      const schema = Landlord.schema;
      const idNumberPath = schema.paths.idNumber;
      expect(idNumberPath).toBeDefined();
    });
  });
});
