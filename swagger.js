const swaggerAutogen = require('swagger-autogen')()

const outputFile = './swagger_output.json'
const endpointsFiles = ['./src/routes/index.mjs']
const doc = {
    info: {
      title: 'DDCC Transacctions Mediator',
      description: 'Demostración de transacciones soportadas por DDCC',
    },
    host: 'localhost:4321',
    schemes: ['http'],
  };
swaggerAutogen(outputFile, endpointsFiles ,doc)