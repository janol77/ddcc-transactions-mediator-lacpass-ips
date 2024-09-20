import logger from "../../logger"
import { transform } from "./structureMaps"

export const processDVCBundle = (coreDataSet) => {

  return new Promise((resolve) => {
    transform( "DVCToBundleDocument", coreDataSet, true)
    .then((transformed) => {
      logger.info("Converted DVC to Bundle")
      resolve(transformed)
    }).catch((err) => {
      logger.info("Error converting DVC to Bundle")
      resolve({ error: JSON.stringify(err) })
    })
  })

}