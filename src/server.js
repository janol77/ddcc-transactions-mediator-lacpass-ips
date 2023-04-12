'use strict'

import {mediatorSetup} from './openhim'
import {SERVER_PORT,STANDALONE,FHIR_SERVER} from './config/config'
import logger from './logger'
import fetch from "node-fetch"

import app from './app'


const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const checkFhirServer = async () => {
  let isOk = false;
  let isOffline = true;
  let fhirServer = new URL(FHIR_SERVER)
  let appServer = `${fhirServer.protocol}//${fhirServer.host}/actuator/health`
  while (isOffline) {
    logger.info("Waiting for FHIR Server...")
    await fetch(appServer)
      .then(response => response.json())
      .then(result => {
        if(result.status == "UP"){
          logger.info("FHIR Server ONLINE...")
          isOffline = false
        }
      })
      .catch((err) => {
           logger.error("Offline: " + err)
      });
      await sleep(5000);
  }
  logger.info("Testing FHIR Server...")
  let bundle = {
    resourceType: "Bundle",
    type: "batch",
    entry: [
      {
        resource: {
          resourceType : "AuditEvent",
          type: [{
            system: "http://dicom.nema.org/resources/ontology/DCM",
            code: "110100"
          }],
          recorded: new Date().toISOString(),
          agent: [
            {
              who: {
                type: "Organization",
                display: "APP"
              },
              requestor: true
            }
          ],
          source: {
            observer: {
              type: "Organization",
              display: "APP"
            }
          }
        },
        request: {
          method: "POST",
          url: "AuditEvent"
        }
      },
      {
        request : {
          method : "GET",
          url : "Patient"
        }
      }     
    ]
  }
  const res = await fetch(FHIR_SERVER, {
    method: "POST",
    body: JSON.stringify(bundle),
    headers: { "Content-Type": "application/fhir+json" }
  })
  .catch((err) => {
    logger.error("Error Testing FHIR Server: " + err)
    process.exit();
  })
  if( res.status == 200){
    logger.info("FHIR Server is ready")
    isOk = true;
  }
  else{
    logger.error("Error Testing FHIR Server: " + err)
    process.exit();    
  }
  return isOk;  
}

checkFhirServer().then(result => {
  if(result){
    app.listen(SERVER_PORT, () => {
      logger.info(`Server listening on Port ${SERVER_PORT}...`)
      if (!STANDALONE) {
        mediatorSetup()
      }
    })
  }
})
