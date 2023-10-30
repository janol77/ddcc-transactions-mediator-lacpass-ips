
import fs from 'fs'
import crypto from 'crypto'

import logger from "../../logger"
import { PRIVATE_KEY_FILE, PUBLIC_KEY_FILE } from "../../config/config"
import { X509Certificate } from 'crypto'

let privateKey, publicKey, x509

if ( fs.existsSync( PRIVATE_KEY_FILE )  && fs.existsSync( PUBLIC_KEY_FILE ) ) {
  logger.info("Loaded private key: " + PRIVATE_KEY_FILE)
  const privKey = fs.readFileSync(PRIVATE_KEY_FILE) || null
  const pubKey = fs.readFileSync(PUBLIC_KEY_FILE) || null
  //publicKey = crypto.createPublicKey( { key: privKey, format: 'pem' } )
  privateKey = crypto.createPrivateKey( { key: privKey, format: 'pem' } )
  x509 = new X509Certificate(pubKey)
  publicKey = x509.publicKey
  logger.info("Loaded x509 key: " + x509.toString());
  logger.info("fingerprint x509 key: " + x509.fingerprint256);
  logger.info("subject  x509 key: " + x509.subject);
} else {
  logger.error("Failed to find private key or cert so creating: " + PRIVATE_KEY_FILE)
  let keyPair = crypto.generateKeyPairSync( 'ec', { namedCurve: 'P-256' } )
  privateKey = keyPair.privateKey
  publicKey = keyPair.publicKey
}
export const PUBLIC_KEY = publicKey.export( { format: 'pem', type: 'spki' } )
export const X509 = x509.toString()
export const PRIVATE_KEY = privateKey.export( { format: 'pem', type: 'pkcs8' } )
export const PRIVATE_KEY_JWK = privateKey.export( {format:'jwk', type:'spki'})
export const PUBLIC_KEY_JWK = publicKey.export( {format:'jwk', type:'spki'})
