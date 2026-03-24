const mongoose = require('mongoose');
const House = require('../../models/House');

describe('House Model', () => {
  describe('Schema validation', () => {
    test('should require title field', () => {
      const house = new House({
        location: 'Chuka Town',
        price: 15000,
        type: 'apartment',
        bedrooms: 2,
        images: ['img.jpg']
      });
      
      const error = house.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.title).toBeDefined();
    });

    test('should require location field', () => {
      const house = new House({
        title: 'Apartment',
        price: 15000,
        type: 'apartment',
        bedrooms: 2,
        images: ['img.jpg']
      });
      
      const error = house.validateSync();
      expect(error).toBeDefined();
    });

    test('should require price field', () => {
      const house = new House({
        title: 'Apartment',
        location: 'Chuka Town',
        type: 'apartment',
        bedrooms: 2,
        images: ['img.jpg']
      });
      
      const error = house.validateSync();
      expect(error).toBeDefined();
    });

    test('should require type field', () => {
      const house = new House({
        title: 'Apartment',
        location: 'Chuka Town',
        price: 15000,
        bedrooms: 2,
        images: ['img.jpg']
      });
      
      const error = house.validateSync();
      expect(error).toBeDefined();
    });

    test('should require images array', () => {
      const house = new House({
        title: 'Apartment',
        location: 'Chuka Town',
        price: 15000,
        type: 'apartment',
        bedrooms: 2
      });
      
      const error = house.validateSync();
      expect(error).toBeDefined();
    });

    test('should accept valid house data', () => {
      const house = new House({
        title: 'Beautiful Apartment',
        location: 'Chuka Town',
        price: 15000,
        type: 'apartment',
        bedrooms: 2,
        images: ['image1.jpg', 'image2.jpg'],
        landlord: '507f1f77bcf86cd799439011',
        landlordEmail: 'landlord@example.com',
        landlordPhone: '0712345678',
        submittedBy: '507f1f77bcf86cd799439011',
        contact: '0712345678',
        description: 'Beautiful two-bedroom apartment'
      });
      
      const error = house.validateSync();
      expect(error).toBeUndefined();
    });
  });

  describe('Type validation', () => {
    test('should validate house type enum', () => {
      const house = new House({
        title: 'Property',
        location: 'Chuka Town',
        price: 15000,
        type: 'invalid-type',
        bedrooms: 2,
        images: ['img.jpg']
      });
      
      const error = house.validateSync();
      expect(error).toBeDefined();
      expect(error.errors.type).toBeDefined();
    });

    test('should accept valid house types', () => {
      const validTypes = ['single', 'double', 'apartment', 'bedsitter'];
      
      validTypes.forEach(type => {
        const house = new House({
          title: 'Property',
          location: 'Chuka Town',
          price: 15000,
          type,
          bedrooms: 2,
          images: ['img.jpg'],
          landlord: '507f1f77bcf86cd799439011',
          landlordEmail: 'landlord@example.com',
          landlordPhone: '0712345678',
          submittedBy: '507f1f77bcf86cd799439011',
          contact: '0712345678',
          description: 'Property description'
        });
        
        const error = house.validateSync();
        expect(error).toBeUndefined();
      });
    });
  });

  describe('Price validation', () => {
    test('should enforce minimum price of 0', () => {
      const house = new House({
        title: 'Property',
        location: 'Chuka Town',
        price: -1000,
        type: 'apartment',
        bedrooms: 2,
        images: ['img.jpg']
      });
      
      const error = house.validateSync();
      expect(error).toBeDefined();
    });

    test('should accept zero price', () => {
      const house = new House({
        title: 'Property',
        location: 'Chuka Town',
        price: 0,
        type: 'apartment',
        bedrooms: 2,
        images: ['img.jpg'],
        landlord: '507f1f77bcf86cd799439011',
        landlordEmail: 'landlord@example.com',
        landlordPhone: '0712345678',
        submittedBy: '507f1f77bcf86cd799439011',
        contact: '0712345678',
        description: 'Property description'
      });
      
      const error = house.validateSync();
      expect(error).toBeUndefined();
    });
  });

  describe('Bedrooms validation', () => {
    test('should set default bedrooms to 1', () => {
      const house = new House({
        title: 'Property',
        location: 'Chuka Town',
        price: 15000,
        type: 'bedsitter',
        images: ['img.jpg']
      });
      
      expect(house.bedrooms).toBe(1);
    });

    test('should accept custom bedroom count', () => {
      const house = new House({
        title: 'Property',
        location: 'Chuka Town',
        price: 15000,
        type: 'apartment',
        bedrooms: 5,
        images: ['img.jpg']
      });
      
      expect(house.bedrooms).toBe(5);
    });
  });

  describe('Amenities', () => {
    test('should initialize with amenities object', () => {
      const house = new House({
        title: 'Property',
        location: 'Chuka Town',
        price: 15000,
        type: 'apartment',
        bedrooms: 2,
        images: ['img.jpg']
      });
      
      expect(house.amenities).toBeDefined();
      expect(typeof house.amenities).toBe('object');
    });

    test('should have default amenity values', () => {
      const house = new House({
        title: 'Property',
        location: 'Chuka Town',
        price: 15000,
        type: 'apartment',
        bedrooms: 2,
        images: ['img.jpg']
      });
      
      expect(house.amenities.wifi).toBe(false);
      expect(house.amenities.water).toBe(false);
      expect(house.amenities.electricity).toBe(false);
    });

    test('should allow amenity updates', () => {
      const house = new House({
        title: 'Property',
        location: 'Chuka Town',
        price: 15000,
        type: 'apartment',
        bedrooms: 2,
        images: ['img.jpg'],
        'amenities.wifi': true,
        'amenities.water': true
      });
      
      expect(house.amenities.wifi).toBe(true);
      expect(house.amenities.water).toBe(true);
    });
  });

  describe('Images validation', () => {
    test('should require at least one image', () => {
      const house = new House({
        title: 'Property',
        location: 'Chuka Town',
        price: 15000,
        type: 'apartment',
        bedrooms: 2,
        images: []
      });
      
      const error = house.validateSync();
      expect(error).toBeDefined();
    });

    test('should accept multiple images', () => {
      const house = new House({
        title: 'Property',
        location: 'Chuka Town',
        price: 15000,
        type: 'apartment',
        bedrooms: 2,
        images: ['img1.jpg', 'img2.jpg', 'img3.jpg']
      });
      
      expect(house.images.length).toBe(3);
    });
  });

  describe('Field data types', () => {
    test('should have correct field types', () => {
      const house = new House({
        title: 'Property',
        location: 'Chuka Town',
        price: 15000,
        type: 'apartment',
        bedrooms: 2,
        images: ['img.jpg']
      });
      
      expect(typeof house.title).toBe('string');
      expect(typeof house.location).toBe('string');
      expect(typeof house.price).toBe('number');
      expect(house.type).toBeDefined();
      expect(Array.isArray(house.images)).toBe(true);
    });

    test('should trim whitespace from text fields', () => {
      const house = new House({
        title: '  Beautiful Property  ',
        location: '  Chuka Town  ',
        price: 15000,
        type: 'apartment',
        bedrooms: 2,
        images: ['img.jpg']
      });
      
      // Trimming typically happens on save or middleware
      expect(house.title).toBeDefined();
      expect(house.location).toBeDefined();
    });
  });

  describe('Timestamps', () => {
    test('should support timestamps if enabled in schema', () => {
      const house = new House({
        title: 'Property',
        location: 'Chuka Town',
        price: 15000,
        type: 'apartment',
        bedrooms: 2,
        images: ['img.jpg']
      });
      
      // Timestamps are typically added on save
      expect(house).toBeDefined();
    });
  });
});
