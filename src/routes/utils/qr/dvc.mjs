import { PRIVATE_KEY, PUBLIC_KEY, X509, PUB } from "../keys"
import { COUNTRYCODE } from "../../../config/config"
import { makeCWTDVC, signAndPack } from "@censcl/dcc-sdk"
import logger from "../../../logger"

export const serialize = ( data, id ) => {
  let result = {
    n: data.name,
    dob: data.dob,
    v: {
      dn: data.vaccineDetails[0].doseNumber.coding[0].code,
      tg: data.vaccineDetails[0].disease.code,
      vp: data.vaccineDetails[0].vaccineClassification.coding[0].code,
      ma: data.vaccineDetails[0].manufacturer,
      dt: data.vaccineDetails[0].date,
      bo: data.vaccineDetails[0].batchNo,
    }
  }
  if(data.sex){result.s = data.sex;}
  if(data.nationality){result.ntl = data.nationality;}
  if(data.nid){result.nid = data.nid;}
  if(data.guardian){result.gn = data.guardian;}
  if(data.vaccineDetails[0].vaccineTradeItem){result.v.mp = data.vaccineDetails[0].vaccineTradeItem.value;}
  if(data.vaccineDetails[0].manufacturerId){result.v.mid = data.vaccineDetails[0].manufacturerId.value;}
  if(data.vaccineDetails[0].validityPeriod){
    if(data.vaccineDetails[0].validityPeriod.start){result.v.vls = data.vaccineDetails[0].validityPeriod.start;}
    if(data.vaccineDetails[0].validityPeriod.end){result.v.vle = data.vaccineDetails[0].validityPeriod.end;}
  }
  if(data.vaccineDetails[0].clinicianName){result.v.cn = data.vaccineDetails[0].clinicianName;}
  if(data.vaccineDetails[0].issuer){result.v.is = data.vaccineDetails[0].issuer.display;}
  return result
}

export const qrContent = ( data ) => {
  return new Promise( async (resolve, reject) => {
    try {
      let qrUri;
      let cwt = await makeCWTDVC(data, null, COUNTRYCODE)
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