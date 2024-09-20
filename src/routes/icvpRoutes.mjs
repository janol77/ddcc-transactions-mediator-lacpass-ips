'use strict'

import express from 'express'

import { buildReturnObject ,buildErrorObject, validateDDCCDocument, retrieveDocument, retrieveListBundle, retrieveDocumentReference, buildHealthCertificateDVC, buildIPSCertificate } from './utils'
import {STANDALONE, PUBLIC_KEY_EC} from '../config/config'
import { PUBLIC_KEY, PUBLIC_KEY_JWK } from "./utils/keys"
import logger from '../logger'

const routes = express.Router()

routes.post('/', async (_req, res) => {
  // #swagger.description = 'Generar Certificado DDCC'
  logger.info('Submit Health Event Endpoint Triggered')
  let returnBundle = {
    resourceType: "Bundle",
    type: "batch-response",
    entry: []
  }

  let batch = _req.body

  if ( batch.resourceType !== 'Bundle' || batch.type !== 'batch' 
    || !batch.entry || !Array.isArray(batch.entry)) {
    return res.send( buildErrorObject( { 
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "error",
          code: "structure",
          diagnostics: "Invalid resource submitted"
        }
      ] 
    } ) )
  }

  for( let entry of batch.entry ) {
    let responseEntry = {
      resource: {},
      response: {}
    }
    if ( entry.request && entry.request.method && entry.request.url && entry.request.method === "POST" 
      && entry.request.url === "QuestionnaireResponse/$generateHealthCertificate"
    ) {
      responseEntry.resource = await buildHealthCertificateDVC( entry.resource )
      if ( responseEntry.resource.resourceType === "OperationOutcome" ) {
        responseEntry.response.status = "500"
      } else {
        responseEntry.response.status = "200"
      }
    } else {
      responseEntry.response.status = "400"
      responseEntry.resource = {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "not-found",
            diagnostics: "Invalid entry resource submitted"
          }
        ]
      }
    }
    returnBundle.entry.push( responseEntry )
  }

  const returnObject = buildReturnObject(
    'Successful',
    200,
    returnBundle
  )
  return res.send(returnObject)
} )

routes.post('/QuestionnaireResponse/$generateHealthCertificate', async (_req, res) => {
  logger.info('Generate Health Certificate Endpoint Triggered')

  let Document = await buildHealthCertificateDVC( _req.body )
  let returnObject

  if ( Document.resourceType !== "Bundle" ) {
    returnObject = buildErrorObject( Document )
  } else {
    returnObject = buildReturnObject(
      'Successful',
      200,
      Document
    )
  }
  return res.send(returnObject)
} )


export default routes
