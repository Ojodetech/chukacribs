/**
 * Swagger/OpenAPI Configuration
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ChukaCribs API',
      version: '1.0.0',
      description: 'Student-focused accommodation website API for Chuka',
      contact: {
        name: 'ChukaCribs Support',
        email: 'support@chukacribs.co.ke'
      }
      license: {
        name: 'MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.chukacribs.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        House: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            location: { type: 'string' },
            price: { type: 'number' },
            description: { type: 'string' },
            images: { type: 'array', items: { type: 'string' } },
            videos: { type: 'array', items: { type: 'string' } },
            amenities: { type: 'array', items: { type: 'string' } },
            landlordName: { type: 'string' },
            landlordPhone: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Landlord: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            idNumber: { type: 'string' },
            status: { type: 'string', enum: ['active', 'inactive', 'suspended'] }
          }
        },
        Token: {
          type: 'object',
          properties: {
            user: { type: 'string' },
            mpesaReceiptNumber: { type: 'string' },
            amount: { type: 'number' },
            expiresAt: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['active', 'expired', 'used'] }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            error: { type: 'string' }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js']
};

let swaggerSpec;
try {
  swaggerSpec = swaggerJsdoc(options);
} catch (error) {
  console.error('Swagger spec generation failed:', error.message);
  swaggerSpec = {
    openapi: '3.0.0',
    info: {
      title: 'ChukaCribs API',
      version: '1.0.0'
    },
    paths: {}
  };
}

/**
 * Setup Swagger UI
 */
const setupSwagger = (app) => {
  try {
    app.use('/api-docs', swaggerUi.serve);
    app.get('/api-docs', swaggerUi.setup(swaggerSpec, {
      customCss: '.topbar { display: none }',
      customSiteTitle: 'ChukaCribs API Docs'
    }));

    console.log('📚 Swagger API docs available at: http://localhost:3000/api-docs');
  } catch (error) {
    console.error('Swagger setup failed:', error.message);
  }
};

module.exports = {
  setupSwagger,
  swaggerSpec
};
