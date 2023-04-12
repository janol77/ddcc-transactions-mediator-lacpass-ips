'use strict'

import express from 'express'

import { buildReturnObject ,buildErrorObject, validateDDCCDocument, retrieveDocument, retrieveListBundle, retrieveDocumentReference, buildHealthCertificate, buildIPSCertificate } from './utils'
import {STANDALONE, PUBLIC_KEY_EC} from '../config/config'
import { PUBLIC_KEY, PUBLIC_KEY_JWK } from "./utils/keys"
import logger from '../logger'

const routes = express.Router()
// ITI-66
routes.get('/List', async (_req, res) => {
  // #swagger.description = 'Obtener Carpeta de Salud (ITI-66)'
  let query = _req.query
  query.code = "folder"


  logger.info('Retrieve Health Folder ITI-66')

  let result = await retrieveListBundle(query)
  let returnObject
  let statusCode = 200

  if ( result.resourceType !== "Bundle" ) {
    logger.info("Did not recieve expected List")
    logger.info("Recevied: " + JSON.stringify(result))
    statusCode = 400
    returnObject = buildErrorObject(result, statusCode)
  } else {
    
    logger.info("Processing elements")
    returnObject = buildReturnObject(
      'Successful',
      statusCode,
      result,
      "application/fhir+json"
    )
  }
  return res.status(statusCode).send(returnObject)
} )
// ITI-68
routes.get('/DocumentReference/:id', async (_req, res) => {
  // #swagger.description = 'Obtener Certificado (ITI-68)'
  let id = _req.params.id
  let accept = "application/fhir+json"
  logger.info('Retrieve DDCCVSDocument triggered ID=' + id)

  let docRef = await retrieveDocumentReference(id)
  let returnObject
  let statusCode = 200

  if ( docRef.resourceType !== "DocumentReference" ) {
    logger.info("Did not recieve expected DocumentReference ID=" + id )
    logger.info("Recevied: " + JSON.stringify(docRef))
    statusCode = 400
    returnObject = buildErrorObject("Could not retrieve DocumentReference", statusCode)
  } else {
    logger.info("Processing DocumentReference ID=" + id)
    let url = docRef.content[0].attachment.url
    let document
    if(docRef.content[0].attachment.contentType == accept) {
      document = await retrieveDocument(url)
      if ( document.resourceType !== "Bundle" ) {
        logger.info("Did not recieve expected DDCCVSDocument=" + url )
        logger.info("Recevied: " + JSON.stringify(document))
        statusCode = 400
        returnObject = buildErrorObject("Could not retrieve DDCCVSDocument", statusCode)
      }
      else {
        logger.info("Processing elements")
        returnObject = buildReturnObject(
          'Successful',
          statusCode,
          document,
          "application/fhir+json"
        )
      }
    }
    else {
      statusCode = 400
      returnObject = buildErrorObject("Could not retrieve DDCCVSDocument", statusCode)
    }
  }

  return res.status(statusCode).send(returnObject)

} )

// Sign Validation
routes.post('/Bundle/([\$])signValidation', async (_req, res) => {
  // #swagger.description = 'Validar Certificado DDCC'
  let document = _req.body
  let returnObject
  let statusCode = 200

  if ( document.resourceType !== 'Bundle' || document.type !== 'document' || !document.signature.data) {
    statusCode = 412
    returnObject = buildErrorObject( { 
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "error",
          code: "structure",
          diagnostics: "The resource need to be a Bundle resource of type document with a signature data"
        }
      ] 
    }, statusCode)
  }
  else{
    let validationResult
    let isVerified = validateDDCCDocument(document)
    // Printing the result
    logger.info('Is signature verified: ' + isVerified);
    validationResult = {
      resourceType: "Parameters",
      parameter : [
        {
        name : "result",
        valueBoolean : isVerified
        }
      ]
    }
    returnObject = buildReturnObject(
      'Successful',
      statusCode,
      validationResult,
      "application/json"
    )
  }
  return res.status(statusCode).send(returnObject)

} )

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
      responseEntry.resource = await buildHealthCertificate( entry.resource )
      if ( responseEntry.resource.resourceType === "OperationOutcome" ) {
        responseEntry.response.status = "500"
      } else {
        responseEntry.response.status = "201"
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

  let Document = await buildHealthCertificate( _req.body )
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

routes.post('/submitIPS', async (_req, res) => {
  logger.info('Submit IPS Endpoint Triggered')

  let Document = await buildIPSCertificate( _req.body )
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

routes.get('/shc_issuer/.well-known/jwks.json', async (_req, res) => {
  let publicKeyJWK = PUBLIC_KEY_JWK
  return res.send(buildReturnObject(
    'Successful',
    200,
    {keys: [PUBLIC_KEY_JWK]}
    )
  )
} )

export default routes
