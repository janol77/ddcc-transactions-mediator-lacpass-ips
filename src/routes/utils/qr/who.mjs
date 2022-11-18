import { PRIVATE_KEY, PUBLIC_KEY } from "../keys"
import { makeCWT, signAndPack } from "@pathcheck/dcc-sdk"
import logger from "../../../logger"

export const serialize = ( data, id ) => {
  return data
}

export const qrContent = ( data ) => {
  return new Promise( async (resolve, reject) => {
    try {
      let cwt = await makeCWT(data)
      logger.info(data)
      logger.info(await cwt)
      logger.info(JSON.stringify(cwt, null, 4))
      const qrUri = await signAndPack( cwt, PUBLIC_KEY, PRIVATE_KEY )
      resolve(qrUri)
    } catch(err) {
      reject(err)
    }
  })
}