'use strict'

import express from 'express'
import swaggerUi from 'swagger-ui-express'
const swaggerFile = require('../../swagger_output.json')
import {buildReturnObject} from './utils'
import ddccRoutes from './ddccRoutes'
import icvpRoutes from './icvpRoutes'
import logger from '../logger'

const routes = express.Router()

routes.use('/icvp', icvpRoutes)
routes.use('/ddcc', ddccRoutes)
routes.use('/doc', swaggerUi.serve, swaggerUi.setup(swaggerFile))
// Add more routes here if needed

// Any request regardless of request type or url path to the mediator port will be caught here
// and trigger the canned response. It may be useful in diagnosing incorrectly configured
// channels from the OpenHIM Console.
routes.all('*', (req, res) => {
  logger.error(
    `Failed! Endpoint "${req.url}" & HTTP method "${req.method}" combination not found.`
  )

  const returnObject = buildReturnObject('Failed', 404, {
    message: 'Combination not found',
    url: req.url,
    method: req.method
  })
  res.status(404).send(returnObject)
})

export default routes
