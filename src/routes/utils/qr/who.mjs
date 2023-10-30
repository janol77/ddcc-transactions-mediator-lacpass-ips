import { PRIVATE_KEY, PUBLIC_KEY, X509, PUB } from "../keys"
import { COUNTRYCODE } from "../../../config/config"
import { makeCWTDDVC, signAndPack } from "@censcl/dcc-sdk"
import logger from "../../../logger"

export const serialize = ( data, id ) => {
  return data
}

export const qrContent = ( data ) => {
  return new Promise( async (resolve, reject) => {
    try {
      let qrUri;
      let cwt = await makeCWTDDVC(data, null, COUNTRYCODE)
      logger.info(data)
      logger.info(await cwt)
      logger.info(JSON.stringify(cwt, null, 4))
      if(X509){
        qrUri = await signAndPack( cwt, X509, PRIVATE_KEY )
      }
      else{
        qrUri = await signAndPack( cwt, PUBLIC_KEY, PRIVATE_KEY )
      }
      logger.info("using contrycode: " + COUNTRYCODE);
      resolve(qrUri)
    } catch(err) {
      reject(err)
    }
  })
}