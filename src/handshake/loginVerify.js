const JWT = require('jsonwebtoken')
const constants = require('./constants')
const debug = require('debug')('minecraft-protocol')
const crypto = require('crypto')
const { verifyOidcToken } = require('./oidc')
const UUID = require('uuid-1345')

module.exports = (client, server, options, dependencies = {}) => {
  // Refer to the docs:
  // https://web.archive.org/web/20180917171505if_/https://confluence.yawk.at/display/PEPROTOCOL/Game+Packets#GamePackets-Login

  const getDER = b64 => crypto.createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' })

  // 26.10, March 2026+
  async function parseTokenData (token) {
    function normalizeToken (token) {
      return token.replace(/^MCToken\s+/i, '')
    }

    const normalized = normalizeToken(token)
    const x5u = getX5U(normalized)
    if (x5u && !options.offline) throw new Error('Self-signed multiplayer token is not allowed with authentication enabled')
    const decoded = x5u
      ? JWT.verify(normalized, getDER(x5u), { algorithms: ['ES384'] })
      : await (dependencies.verifyOidcToken || verifyOidcToken)(normalized, options.version)
    if (!decoded || typeof decoded !== 'object') throw new Error('Invalid login token')

    const payload = decoded || {}
    const key = payload.cpk || payload.clientPublicKey || x5u
    if (!key) throw new Error('Login token is missing the client public key')
    getDER(key)

    const xuid = payload.xid || payload.XUID || payload.xuid || '0'
    const identity = payload.leguuid || payload.identity || identityFromXuid(xuid)
    return {
      key,
      data: {
        extraData: {
          XUID: xuid,
          displayName: payload.xname || payload.displayName || 'Player',
          identity,
          PlayFabID: payload.mid || payload.pfbid || payload.playFabId || payload.PlayFabID,
          PlayFabTitleID: payload.tid || payload.pfbtid || payload.playFabTitleId || payload.PlayFabTitleID
        }
      }
    }
  }

  async function verifyAuth (chain, token) {
    // In 26.10+, identity may be carried by the multiplayer token with no certificate chain.
    if ((!chain || chain.length === 0 || chain.every(entry => !entry)) && token) {
      return parseTokenData(token)
    }

    let data = {}

    // There are three JWT tokens sent to us, one signed by the client
    // one signed by Mojang with the Mojang token we have and another one
    // from Xbox with addition user profile data
    // We verify that at least one of the tokens in the chain has been properly
    // signed by Mojang by checking the x509 public key in the JWT headers
    let didVerify = false

    let pubKey = getDER(getX5U(chain[0])) // the first one is client signed, allow it
    let finalKey = null

    for (const token of chain) {
      const decoded = JWT.verify(token, pubKey, { algorithms: ['ES384'] })

      // Check if signed by Mojang key
      const x5u = getX5U(token)
      if (x5u === constants.PUBLIC_KEY && !data.extraData?.XUID) {
        didVerify = true
        debug('Verified client with mojang key', x5u)
      }

      pubKey = decoded.identityPublicKey ? getDER(decoded.identityPublicKey) : x5u
      finalKey = decoded.identityPublicKey || finalKey // non pem
      data = { ...data, ...decoded }
    }

    if (!didVerify && !options.offline) {
      client.disconnect('disconnectionScreen.notAuthenticated')
    }

    return { key: finalKey, data }
  }

  function verifySkin (publicKey, token) {
    const pubKey = getDER(publicKey)
    const decoded = JWT.verify(token, pubKey, { algorithms: ['ES384'] })
    return decoded
  }

  client.decodeLoginJWT = async (authTokens, skinTokens, authToken = '') => {
    const { key, data } = await verifyAuth(authTokens, authToken)
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

function identityFromXuid (xuid) {
  const hash = crypto.createHash('md5').update('pocket-auth-1-xuid:').update(xuid).digest()
  hash[6] = (hash[6] & 0x0f) | 0x30
  hash[8] = (hash[8] & 0x3f) | 0x80
  return UUID.stringify(hash)
}

function getX5U (token) {
  const [header] = token.split('.')
  const hdec = Buffer.from(header, 'base64').toString('utf-8')
  const hjson = JSON.parse(hdec)
  return hjson.x5u
}
