import logger from "../../logger"
import fetch from "node-fetch"

import { MATCHBOX_SERVER, DDCC_CANONICAL_BASE, DVC_CANONICAL_BASE } from "../../config/config"


export const transform = (structureMap, input, dvc=false) => {
  let base = DDCC_CANONICAL_BASE
  if (dvc) {
    base = DVC_CANONICAL_BASE
  }
  return new Promise( (resolve, reject) => {
    fetch( MATCHBOX_SERVER + "StructureMap/$transform?source="
      + base + "StructureMap/" + structureMap, {
        method: "POST",
        body: JSON.stringify(input),
        headers: { 
          "Content-Type": "application/fhir+json;fhirVersion=4.0",
          "Accept": "application/fhir+json;fhirVersion=4.0" 
        }
      })
      .then( (res) => res.json())
      .then( (json) => {
        if (json.resourceType == "OperationOutcome") {
          return Promise.reject(json.issue);
        }
        resolve(json)
      })
      .catch( (err) => {
        logger.info("Error calling structure map: "+structureMap)
        reject(err)
      })
  } )
}
