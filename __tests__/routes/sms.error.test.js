const axios = require('axios');
jest.mock('axios');

describe('SMS provider error handling', () => {
  const loadSmsModule = () => {
    jest.resetModules();
    return require('../../config/sms');
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMS_ENABLED = 'true';
    process.env.AFRICASTALKING_USERNAME = 'testuser';
    process.env.AFRICASTALKING_API_KEY = 'testkey';
    process.env.TEXTSMS_API_KEY = 'textsms-api-key';
    process.env.SMS_PROVIDER = 'africastalking';
  });

  afterEach(() => {
    delete process.env.SMS_PROVIDER;
    delete process.env.SMS_ENABLED;
    delete process.env.AFRICASTALKING_USERNAME;
    delete process.env.AFRICASTALKING_API_KEY;
    delete process.env.TEXTSMS_API_KEY;
  });

  test('should return failure when africastalking request throws', async () => {
    const { sendSMS } = loadSmsModule();
    const freshAxios = require('axios');
    freshAxios.post.mockRejectedValue(new Error('Network failure'));

    const result = await sendSMS('0712345678', 'Test message');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network failure');
    expect(result.provider).toBe('africastalking');
  });

  test('should return failure when textsms request throws', async () => {
    process.env.SMS_PROVIDER = 'textsms';
    const { sendSMS } = loadSmsModule();
    const freshAxios = require('axios');
    freshAxios.post.mockRejectedValue({ message: 'Timeout', response: { data: { error: 'Rate limit exceeded' } } });

    const result = await sendSMS('0712345678', 'Test message');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Timeout');
    expect(result.reason).toBe('Rate limit exceeded');
    expect(result.provider).toBe('textsms');
  });

  test('should return AFRICASTALKING_CREDENTIALS_MISSING when credentials are unset', async () => {
    process.env.AFRICASTALKING_API_KEY = '';
    const { sendSMS } = loadSmsModule();

    const result = await sendSMS('0712345678', 'msg');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('AFRICASTALKING_CREDENTIALS_MISSING');
  });
});