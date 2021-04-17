const JWT = require('jsonwebtoken')
const constants = require('./constants')
const debug = require('debug')('minecraft-protocol')

module.exports = (client, server, options) => {
  // Refer to the docs:
  // https://web.archive.org/web/20180917171505if_/https://confluence.yawk.at/display/PEPROTOCOL/Game+Packets#GamePackets-Login

  function verifyAuth (chain) {
    let data = {}

    // There are three JWT tokens sent to us, one signed by the client
    // one signed by Mojang with the Mojang token we have and another one
    // from Xbox with addition user profile data
    // We verify that at least one of the tokens in the chain has been properly
    // signed by Mojang by checking the x509 public key in the JWT headers
    let didVerify = false

    let pubKey = mcPubKeyToPem(getX5U(chain[0])) // the first one is client signed, allow it
    let finalKey = null
    // console.log(pubKey)
    for (const token of chain) {
      const decoded = JWT.verify(token, pubKey, { algorithms: ['ES384'] })
      // console.log('Decoded', decoded)

      // Check if signed by Mojang key
      const x5u = getX5U(token)
      if (x5u === constants.PUBLIC_KEY && !data.extraData?.XUID) {
        didVerify = true
        debug('Verified client with mojang key', x5u)
      }

      pubKey = decoded.identityPublicKey ? mcPubKeyToPem(decoded.identityPublicKey) : x5u
      finalKey = decoded.identityPublicKey || finalKey // non pem
      data = { ...data, ...decoded }
    }
    // console.log('Result', data)

    if (!didVerify && !options.offline) {
      client.disconnect('disconnectionScreen.notAuthenticated')
    }

    return { key: finalKey, data }
  }

  function verifySkin (publicKey, token) {
    const pubKey = mcPubKeyToPem(publicKey)
    const decoded = JWT.verify(token, pubKey, { algorithms: ['ES384'] })
    return decoded
  }

  client.decodeLoginJWT = (authTokens, skinTokens) => {
    const { key, data } = verifyAuth(authTokens)
    const skinData = verifySkin(key, skinTokens)
    return { key, userData: data, skinData }
  }

  client.encodeLoginJWT = (localChain, mojangChain) => {
    const chains = []
    chains.push(localChain)
    for (const chain of mojangChain) {
      chains.push(chain)
    }
    return chains
  }
}

function getX5U (token) {
  const [header] = token.split('.')
  const hdec = Buffer.from(header, 'base64').toString('utf-8')
  const hjson = JSON.parse(hdec)
  return hjson.x5u
}

function mcPubKeyToPem (mcPubKeyBuffer) {
  if (mcPubKeyBuffer[0] === '-') return mcPubKeyBuffer
  let pem = '-----BEGIN PUBLIC KEY-----\n'
  let base64PubKey = mcPubKeyBuffer.toString('base64')
  const maxLineLength = 65
  while (base64PubKey.length > 0) {
    pem += base64PubKey.substring(0, maxLineLength) + '\n'
    base64PubKey = base64PubKey.substring(maxLineLength)
  }
  pem += '-----END PUBLIC KEY-----\n'
  return pem
}
