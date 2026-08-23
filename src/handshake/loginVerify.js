const { createLoginVerifier } = require('../auth/loginVerifier')

// Install direct verification methods while preserving decodeLoginJWT for
// callers using the older API shape.
module.exports = (client, server, options, dependencies = {}) => {
  const verifier = createLoginVerifier(options, dependencies)
  client.verifyLogin = verifier.verifyLogin

  client.decodeLoginJWT = async (authTokens, skinToken, authToken = '') => {
    const result = await client.verifyLogin({
      chain: authTokens,
      multiplayerToken: authToken,
      clientDataToken: skinToken
    })
    return {
      key: result.clientPublicKeyBase64,
      userData: { extraData: result.identity },
      skinData: result.clientData,
      authentication: result.authentication
    }
  }

  client.encodeLoginJWT = (localChain, mojangChain) => [localChain, ...mojangChain]
}
