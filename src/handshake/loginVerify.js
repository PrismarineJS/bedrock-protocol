const { createLoginVerifier } = require('../auth/loginVerifier')

// Compatibility adapter for callers that use decodeLoginJWT directly. New
// server code should call createLoginVerifier().verifyLogin() instead.
module.exports = (client, server, options, dependencies = {}) => {
  const verifier = createLoginVerifier(options, dependencies)

  client.decodeLoginJWT = async (authTokens, skinToken, authToken = '') => {
    const result = await verifier.verifyLogin({
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
