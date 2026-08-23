const { AuthenticationError } = require('./loginVerifier')

function parseJson (value, label) {
  if (typeof value !== 'string') throw new AuthenticationError(`${label} must be a JSON string`)
  try {
    return JSON.parse(value)
  } catch (error) {
    throw new AuthenticationError(`${label} is invalid JSON: ${error.message}`)
  }
}

function parseLoginEnvelope (packet) {
  const params = packet?.data?.params
  const tokens = params?.tokens
  if (!tokens || typeof tokens !== 'object') throw new AuthenticationError('Login packet is missing tokens')
  if (typeof tokens.client !== 'string' || tokens.client.length === 0) {
    throw new AuthenticationError('Login packet is missing its client-data token')
  }

  const identityEnvelope = parseJson(tokens.identity, 'Login identity envelope')
  if (identityEnvelope.AuthenticationType === 1) {
    throw new AuthenticationError('Guest authentication is not supported')
  }

  const multiplayerToken = identityEnvelope.Token || ''
  let chain
  if (identityEnvelope.Certificate) {
    chain = parseJson(identityEnvelope.Certificate, 'Login Certificate').chain
  } else if (identityEnvelope.chain) {
    chain = identityEnvelope.chain
  } else if (multiplayerToken) {
    chain = []
  } else {
    throw new AuthenticationError('Login packet is missing its chain or Certificate')
  }

  if (!Array.isArray(chain)) throw new AuthenticationError('Login certificate chain must be an array')
  return {
    protocolVersion: params.protocol_version,
    authenticationType: identityEnvelope.AuthenticationType,
    chain,
    multiplayerToken,
    clientDataToken: tokens.client
  }
}

module.exports = { parseLoginEnvelope }
