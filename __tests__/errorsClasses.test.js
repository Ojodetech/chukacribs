const errors = require('../config/errors');

describe('Custom Error Classes', () => {
  test('AppError sets properties and toJSON', () => {
    const { AppError } = errors;
    const err = new AppError('Test error', 418, 'TEST_CODE', { foo: 'bar' });

    const json = err.toJSON();
    expect(json.success).toBe(false);
    expect(json.statusCode).toBe(418);
    expect(json.errorCode).toBe('TEST_CODE');
    expect(json.message).toBe('Test error');
    expect(json.details).toEqual({ foo: 'bar' });
    expect(json.timestamp).toBeDefined();
  });

  test('ValidationError creates details array', () => {
    const { ValidationError } = errors;
    const ve = new ValidationError('Invalid', [{ field: 'email', message: 'invalid' }]);

    expect(ve.statusCode).toBe(400);
    expect(ve.errorCode).toBe('VALIDATION_ERROR');
    expect(Array.isArray(ve.details)).toBe(true);
    expect(ve.details[0].field).toBe('email');
  });

  test('DatabaseError.fromDuplicateKeyError returns proper details', () => {
    const { DatabaseError } = errors;
    const mongoErr = { code: 11000, keyValue: { email: 'a@b.com' } };
    const de = DatabaseError.fromDuplicateKeyError(mongoErr);

    expect(de).toBeDefined();
    expect(de.message).toMatch(/email already exists/i);
    expect(de.details.field).toBe('email');
    expect(de.details.value).toBe('a@b.com');
  });
});
