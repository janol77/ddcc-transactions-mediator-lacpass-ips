"use strict"

import { v4 as uuidv4 } from "uuid"

import fetch from "node-fetch"
import crypto from "crypto"

import logger from "../../logger"
import { FHIR_SERVER, FOLDER_IDENTIFIER_SYSTEM, STANDALONE, DDCC_IDENTIFIER_SYSTEM } from "../../config/config"

import { processDDCCBundle } from "./ddccBundle"
import { convertQRToCoreDataSet, convertQRToDVC, convertIPSToCoreDataSet } from "./logicalModel"
import { addAllContent, generateDVCCert } from "./qr"

import { PRIVATE_KEY, PUBLIC_KEY } from "./keys"

import canonicalize from "./canonicalize"

let urn

const initializeDVCOptions = () => {
  let options = {
    resources: {},
    questionnaire: "http://smart.who.int/icvp/Questionnaire/Questionnaire-DVCModel",
    version : "",
    responses: {},
    ids: {},
    images: {},
    pdfs: {},
    dataURLs: {},
    content64: {}
  }
  options.now = new Date().toISOString()

  return options
}

const initializeDDCCOptions = () => {
  let options = {
    resources: {},
    questionnaire: "http://worldhealthorganization.github.io/ddcc/DDCCVSCoreDataSetQuestionnaire",
    /*
    content: { 
      who: { data: '', id: '', image: '', data64: '', pdf: '' }, 
      dcc: { data: '', id: '', image: '', data64: '', pdf: '' } 
    },
    */
    version : "RC-2-draft",
    responses: {},
    ids: {},
    images: {},
    pdfs: {},
    dataURLs: {},
    content64: {}
  }
  options.now = new Date().toISOString()

  return options
}

export const setMediatorUrn = (mediatorUrn) => {
  urn = mediatorUrn
}

// The OpenHIM accepts a specific response structure which allows transactions to display correctly
// The openhimTransactionStatus can be one of the following values:
// Successful, Completed, Completed with Errors, Failed, or Processing
export const buildReturnObject = (
  openhimTransactionStatus,
  httpResponseStatusCode,
  responseBody,
  responseContentType
) => {
  let response = responseBody
  if ( !STANDALONE ) {
    response = {
      "x-mediator-urn": urn,
      status: openhimTransactionStatus,
      response: {
        status: httpResponseStatusCode || 400,
        headers: { "content-type": responseContentType || "application/json" },
        body: responseBody,
        timestamp: new Date()
      },
      properties: { property: "Primary Route" }
    }
  }
  return response
}


export const buildErrorObject = (errorMessage, code) => {
  return buildReturnObject("Failed", code, errorMessage)
}

export const retrieveDocumentReference = (id) => {
  logger.info("Retrieving Document Reference " + id)
  return retrieveResource( "DocumentReference/" + id )
}

export const retrieveListBundle = (query) => {
  logger.info("Retrieving List")
  return retrieveResource( "List?" + new URLSearchParams(query) )
}

export const validateDDCCDocument = (document) => {
  logger.info("Verifying signature")
  // Verifying signature using crypto.verify() function
  let data = document.signature.data
  delete document.meta
  delete document.id
  delete document.signature
  const isVerified = crypto.verify("SHA256", canonicalize(document), PUBLIC_KEY, Buffer.from(data, 'base64'));  
  return isVerified
}

export const retrieveResource = (id, server) => {
  if (!server) server = FHIR_SERVER
  return new Promise((resolve) => {
    fetch(server + id, {
      method: "GET",
      headers: { 
        "Content-Type": "application/fhir+json", 
        "Cache-Control": "no-cache" 
      }
    })
      .then((res) => res.json())
      .then((json) => {
        logger.info("Retrieved ID="+id)
        resolve(json)
      })
      .catch((err) => {
        logger.info("Error retrieving Resource ID=" + id)
        resolve({ error: JSON.stringify(err) })
      })
  })
}

export const expungeResource = (id, server) => {
  if (!server) server = FHIR_SERVER
  return new Promise((resolve) => {
    let content = {
      resourceType: "Parameters",
      parameter: [
        {
          name: "expungeDeletedResources",
          valueBoolean: true
        }
      ]
    }
    fetch(server + id + "?_expunge=true", {
      method: "DELETE",
      headers: { 
        "Content-Type": "application/fhir+json"
      }
    })
      .then((res) => res.json())
      .then((json) => {
        logger.info("Expunge ID="+id)
        resolve(json)
      })
      .catch((err) => {
        logger.info("Error deleting Resource ID=" + id)
        resolve({ error: JSON.stringify(err) })
      })
  })
}

export const retrieveDocument = (url) => {
  return new Promise((resolve) => {
    fetch(url, {
      method: "GET",
      headers: { 
        "Content-Type": "application/fhir+json", 
        "Cache-Control": "no-cache" 
      }
    })
      .then((res) => res.json())
      .then((json) => {
        logger.info("Retrieved Document")
        resolve(json)
      })
      .catch((err) => {
        logger.info("Error retrieving Document: " + url)
        resolve({ error: JSON.stringify(err) })
      })
  })
}

//one needs to be defined for each questtonnaire handled
let QResponseInitializers = {
  "http://worldhealthorganization.github.io/ddcc/DDCCVSCoreDataSetQuestionnaire": initializeDDCCOptions,
  "http://smart.who.int/icvp/Questionnaire/Questionnaire-DVCModel": initializeDVCOptions
}

export const buildHealthCertificate = (DDCCParameters) => {
  return new Promise(async (resolve) => {
    
    let QResponse = undefined
    let options
    if (DDCCParameters.resourceType === "QuestionnaireResponse") {
      QResponse = DDCCParameters
    } else {
      if (DDCCParameters.resourceType !== "Parameters" || !DDCCParameters.parameter) {
        resolve({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "required",
              diagnostics: "Invalid resource submitted."
            }
          ]
        })
      }

      let responseParam = DDCCParameters.parameter.find((param) => param.name === "response")
      if (responseParam && responseParam.resource) {
        QResponse = responseParam.resource
        if (QResponse.resourceType !== "QuestionnaireResponse") {
          resolve({
            resourceType: "OperationOutcome",
            issue: [
              {
                severity: "error",
                code: "required",
                diagnostics: "Invalid response resource."
              }
            ]
          })
        }
      } else {
        resolve({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "required",
              diagnostics: "Unable to find response or immunization/hcid parameters."
            }
          ]
        })
      }
    }

    if ( !(QResponse.questionnaire in QResponseInitializers)) {
      return resolve({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "required",
            diagnostics: "Do not know how to handle " + QResponse.questionnaire
          }
        ]
      })
    }

    options = QResponseInitializers[QResponse.questionnaire]()
    options.resources.QuestionnaireResponse = QResponse
    options.responses = await convertQRToCoreDataSet(QResponse)
    //logger.info(JSON.stringify(options.responses, null, 4))
    if ( !options.responses || options.responses.error ) {
      return resolve({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "required",
            diagnostics: "Error converting to core data set: " + options.responses.error
          }
        ]
      })
    } else if ( options.responses.resourceType === "OperationOutcome" ) {
      return resolve(options.responses)
    }
    compileHealthCertificate(options, QResponse).then((results) => {
      return resolve(results)
    })
  })
}

export const buildHealthCertificateDVC = (DVCParameters) => {
  return new Promise(async (resolve) => {
    
    let QResponse = undefined
    let options
    if (DVCParameters.resourceType === "QuestionnaireResponse") {
      QResponse = DVCParameters
    } else {
      resolve({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "required",
            diagnostics: "Invalid resource submitted."
          }
        ]
      })
    }

    if ( !(QResponse.questionnaire in QResponseInitializers)) {
      return resolve({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "required",
            diagnostics: "Do not know how to handle " + QResponse.questionnaire
          }
        ]
      })
    }

    options = QResponseInitializers[QResponse.questionnaire]()
    options.resources.QuestionnaireResponse = QResponse
    options.responses = await convertQRToDVC(QResponse)
    if ( !options.responses || options.responses.error ) {
      return resolve({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "required",
            diagnostics: "Error converting to core data set: " + options.responses.error
          }
        ]
      })
    } else if ( options.responses.resourceType === "OperationOutcome" ) {
      return resolve(options.responses)
    }
    compileHealthCertificateDVC(options, QResponse).then((results) => {
      return resolve(results)
    })
  })
}

/*
For IPS method:

* set up options as above (line 177) for each logical model in return bundle from IPS structuremap.
* call compileHealthCertificate for each.  return last result
  * update compileHealthCertificate to make QResponse argument optional
*/

export const buildIPSCertificate = (ips) => {
  return new Promise( async (resolve) => {
    let lmBundle = await convertIPSToCoreDataSet( ips )
    if ( !lmBundle || lmBundle.error ) {
      return resolve({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "required",
            diagnostics: "Error converting to core data set: " + lmBundle.error
          }
        ]
      })      
    } else {
      let results
      for( let lmEntry of lmBundle.entry ) {
        let options = QResponseInitializers["http://worldhealthorganization.github.io/ddcc/DDCCVSCoreDataSetQuestionnaire"]()
        options.responses = lmBundle.entry.resource
        results = await compileHealthCertificate(options)
      }
      return resolve(results)
    }
  } )
}

const compileHealthCertificate = (options, QResponse) => {
  return new Promise(async (resolve) => {
    //START Verifying existing Organization using pha as Organization name
    let existingOrganization = await retrieveResource(
      "Organization?name=" + options.responses.certificate.issuer.identifier.value
    )
    if (
      existingOrganization &&
      existingOrganization.resourceType === "Bundle" &&
      existingOrganization.total > 0 &&
      existingOrganization.entry &&
      existingOrganization.entry[0].resource.resourceType === "Organization"
    ) {
      options.resources.Organization = existingOrganization.entry[0].resource
    }
    //END Verifying existing Organization using pha as Organization name
    //START Verifying existing Patient using identifier as Patient identifier
    if(!options.responses.identifier){
      return resolve({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            diagnostics: "Missing patient identifier"
          }
        ]
      })
    }
    let existingPatient = await retrieveResource(
      "Patient?identifier=" + options.responses.identifier
    )
    if (
      existingPatient &&
      existingPatient.resourceType === "Bundle" &&
      existingPatient.total > 0 &&
      existingPatient.entry &&
      existingPatient.entry[0].resource.resourceType === "Patient"
    ) {
      options.resources.Patient = existingPatient.entry[0].resource
    }
    //END Verifying existing Organization using identifier as Patient identifier
    let existingFolder = await retrieveResource(
      "List?identifier=" + FOLDER_IDENTIFIER_SYSTEM + "|" + options.responses.certificate.hcid.value
    )
    if (
      existingFolder &&
      existingFolder.resourceType === "Bundle" &&
      existingFolder.total > 0 &&
      existingFolder.entry &&
      existingFolder.entry[0].resource.resourceType === "List"
    ) {
      options.resources.List = existingFolder.entry[0].resource
    }

    let addBundle = await processDDCCBundle(options.responses)
    if ( !addBundle || addBundle.error ) {
      return resolve({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            diagnostics: addBundle.error
          }
        ]
      })
    }
/*     
    if ( QResponse ) {
      addBundle.entry.push( {
        resource: QResponse,
        request: {
          method: "POST",
          url: "QuestionnaireResponse"
        }
      })
    }
 */

    let addPatient = addBundle.entry && addBundle.entry.find((entry) => entry.resource && entry.resource.resourceType === "Patient")
    if (addPatient) {
      if(!options.resources.Patient ){
        options.resources.Patient = addPatient.resource
      }
      else{
        logger.info( "Patient identifier: " + options.responses.identifier + " exist")
      }
    } else {
      return resolve({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            diagnostics: "Missing Patient in addBundle."
          }
        ]
      })
    }
    try {
      //logger.info(JSON.stringify(addBundle, null, 4))
      await addAllContent( addBundle, options.responses )
    } catch( err ) {
      logger.error( "Failed to add QR content to addBundle: " + err.message )
    }
    // START fix Organization ID
    if ( options.resources.Organization ) {
      let orgId = options.resources.Organization.id
      let orgfix = addBundle.entry.find( entry => entry.resource && entry.resource.resourceType === "Organization")
      orgfix.resource.id = orgId
      orgfix.request.url = "Organization/" + orgId
    }
    // END fix Organization ID
    // START fix Patient ID
    if ( options.resources.Patient ) {
      let patId = options.resources.Patient.id
      let patfix = addBundle.entry.find( entry => entry.resource && entry.resource.resourceType === "Patient")
      patfix.resource.id = patId
      patfix.request.url = "Patient/" + patId
    }
    // END fix Patient ID
    logger.info("transaction")
    fetch(FHIR_SERVER, {
        method: "POST",
        body: JSON.stringify(addBundle),
        headers: { "Content-Type": "application/fhir+json" }
    }).then( res => res.json() )
    .then( json => {
      logger.info("transaction response")
      let compEntry = addBundle.entry.find( entry => entry.resource && entry.resource.resourceType === "Composition" )
      if ( !compEntry ) {
        return resolve({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "exception",
              diagnostics: "Missing Composition in addBundle."
            }
          ]
        })
      }


      fetch(FHIR_SERVER + "Composition/" + compEntry.resource.id + "/$document")
      .then((res) => res.json())
      .then((doc) => {
        let docId = (options.responses.certificate.ddccid && options.responses.certificate.ddccid.value) || uuidv4()
        doc.identifier = [ {
          system: DDCC_IDENTIFIER_SYSTEM,
          value: docId
        } ]
        doc.link = [ { relation: "publication", url: "urn:HCID:" + options.responses.certificate.hcid.value } ]
        doc.entry = addBundle.entry
        doc.timestamp = options.now
        delete doc.total
        doc.entry.forEach(entry => {
          delete entry.request
        });
        doc.id = docId
        let docBundle = {
          resourceType: "Bundle",
          type: "transaction",
          entry: [
            {
              fullUrl: "urn:uuid:" + docId,
              resource: doc,
              request: {
                method: "PUT",
                url: "Bundle/"+docId
              }
            }
          ]
        }
        fetch(FHIR_SERVER, {
          method: "POST",
          body: JSON.stringify(docBundle),
          headers: { "Content-Type": "application/fhir+json" }
        })
          .then((res) => res.json())
          .then(async (docAdded) => {
            let savedDoc = await retrieveResource(docAdded.entry[0].response.location)
            let bundleDocID = savedDoc.id
            //INICIO Agregar firma al documento
            delete savedDoc.meta
            delete savedDoc.id
            //logger.info(doc)
            let sign = crypto.sign("SHA256", canonicalize(savedDoc), PRIVATE_KEY)
            savedDoc.signature = {
              type: [
                {
                  system: "urn:iso-astm:E1762-95:2013",
                  code: "1.2.840.10065.1.12.1.5"
                }
              ],
              when: options.now,
              who: { identifier: { value: options.responses.certificate.issuer.identifier.value } },
              data: sign.toString("base64")
            }
            // EXPUNGE RESOURCES
            let compToDelete = addBundle.entry.find( entry => entry.resource && entry.resource.resourceType === "Composition")
            if ( compToDelete ) {await expungeResource("Composition/" + compToDelete.resource.id)}
            let imnRecToDelete = addBundle.entry.find( entry => entry.resource && entry.resource.resourceType === "ImmunizationRecommendation")
            if ( imnRecToDelete ) {await expungeResource("ImmunizationRecommendation/" + imnRecToDelete.resource.id)}  
            let imnToDelete = addBundle.entry.find( entry => entry.resource && entry.resource.resourceType === "Immunization")
            if ( imnToDelete ) {await expungeResource("Immunization/" + imnToDelete.resource.id)}   
            let docrefToDelete = addBundle.entry.find( entry => entry.resource && entry.resource.resourceType === "DocumentReference")
            if ( docrefToDelete ) {await expungeResource("DocumentReference/" + docrefToDelete.resource.id)}                               
            let orgToDelete = addBundle.entry.find( entry => entry.resource && entry.resource.resourceType === "Organization")
            if ( orgToDelete ) {await expungeResource("Organization/" + orgToDelete.resource.id)}     
            let patToDelete = addBundle.entry.find( entry => entry.resource && entry.resource.resourceType === "Patient")
            if ( patToDelete ) {await expungeResource("Patient/" + patToDelete.resource.id)}          
            savedDoc.id = bundleDocID
            fetch(FHIR_SERVER + "Bundle/" + bundleDocID, {
              method: "PUT",
              body: JSON.stringify(savedDoc),
              headers: { "Content-Type": "application/fhir+json" }
            })
              .then((res) => res.json())
              .then(async (docUpdated) => {
                // // Verifying signature using crypto.verify() function
                // let data = docUpdated.signature.data
                // delete docUpdated.meta
                // delete docUpdated.id
                // delete docUpdated.signature
                // const isVerified2 = crypto.verify("SHA256", canonicalize(docUpdated), PUBLIC_KEY, Buffer.from(data, 'base64'));
                // // Printing the result
                // logger.info('Is signature verified: ' + isVerified2);
                logger.info("docBundle")
                //createProvideDocumentBundle(doc, options)
                resolve(docUpdated)
              })
            //FIN Agregar firma al documento

          })
          .catch((err) => {
            return resolve({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "exception",
                  diagnostics: err.message
                }
              ]
            })
          })
      })
      .catch((err) => {
        return resolve({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "exception",
              diagnostics: err.message
            }
          ]
        })
      })

    }).catch( err => {
      return resolve({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            diagnostics: err.message
          }
        ]
      })
    })
  })
}

const compileHealthCertificateDVC = (options, QResponse) => {
  return new Promise(async (resolve) => {
    let documentReference = {
      resourceType: "DocumentReference",
      status: "current",
      type: {
        coding: [
          {
            system: "http://worldhealthorganization.github.io/icvp/CodeSystem/DVC-QR-Type-CodeSystem",
            code: "dvc"
          }
        ]
      },
      content: [
        {
          attachment: {
            contentType: "image/png",
            data:""
          }
        }
      ]
    }
    try {
      //logger.info(JSON.stringify(addBundle, null, 4))
      logger.info("generate QR code")
      await generateDVCCert(documentReference, options.responses)
    } catch( err ) {
      logger.error( "Failed to generate QR code: " + err.message )
      return resolve({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            diagnostics: err.message
          }
        ]
      })
    }
    resolve(documentReference)

  })
  .catch( err => {
    return resolve({
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "error",
          code: "exception",
          diagnostics: err.message
        }
      ]
    })
  })
}
