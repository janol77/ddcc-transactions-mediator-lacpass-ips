'use strict'

let urn

export const setMediatorUrn = mediatorUrn => {
  urn = mediatorUrn
}

// The OpenHIM accepts a specific response structure which allows transactions to display correctly
// The openhimTransactionStatus can be one of the following values:
// Successful, Completed, Completed with Errors, Failed, or Processing
export const buildReturnObject = (
  openhimTransactionStatus,
  httpResponseStatusCode,
  responseBody
) => {
  const response = {
    status: httpResponseStatusCode,
    headers: {'content-type': 'application/json'},
    body: responseBody,
    timestamp: new Date()
  }
  return {
    'x-mediator-urn': urn,
    status: openhimTransactionStatus,
    response,
    properties: {property: 'Primary Route'}
  }
}

export const buildErrorObject = (
  errorMessage
) => {
  return buildReturnObject( 'Failed', 401, errorMessage )
}

export const buildHealthCertificate = (
  SHCQuestionnaireResponse
) => {
  let QRCode = {
    resourceType: "Binary"
  }
  let QRContent = {
    resourceType: "QuestionnaireResponse"
  }
  let certificateUri = ""
  let returnParameters = {
    resourceType: "Parameters",
    parameter: [
      {
        name: "qr-code",
        resource: QRCode
      },
      {
        name: "qr-content",
        resource: QRContent
      },
      {
        name: "certificate",
        valueUri: certificateUri
      }
    ]
  }

  return returnParameters
}
