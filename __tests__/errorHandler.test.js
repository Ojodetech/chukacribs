const { enhancedErrorHandler } = require('../config/errors/errorHandler');
const { AppError } = require('../config/errors');

describe('Enhanced Error Handler Middleware', () => {
  const makeRes = () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    return { status, json };
  };

  test('handles AppError and returns formatted response', () => {
    const req = { method: 'GET', path: '/test', ip: '127.0.0.1', get: () => 'ua', userId: 'user1' };
    const res = makeRes();
    const err = new AppError('Boom', 400, 'TEST_ERR', { foo: 'bar' });

    enhancedErrorHandler(err, req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.status().json).toHaveBeenCalled();
    const body = res.status().json.mock.calls[0][0];
    expect(body.errorCode).toBe('TEST_ERR');
    expect(body.message).toBe('Boom');
  });

  test('converts generic Error to AppError and returns 500', () => {
    const req = { method: 'POST', path: '/test2', ip: '127.0.0.1', get: () => 'ua' };
    const res = makeRes();
    const generic = new Error('Unexpected');

    enhancedErrorHandler(generic, req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.status().json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.message).toMatch(/unexpected/i);
  });
});
