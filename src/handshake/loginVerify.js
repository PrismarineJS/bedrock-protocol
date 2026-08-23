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
  const samePublicKey = (left, right) => left.export({ format: 'der', type: 'spki' }).equals(right.export({ format: 'der', type: 'spki' }))

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
    // In 1.26.10+, the verified multiplayer token is authoritative even if a
    // legacy certificate chain is also present.
    if (token) return parseTokenData(token)

    if (!Array.isArray(chain) || (chain.length !== 1 && chain.length !== 3)) {
      throw new Error(`Unexpected login chain length ${chain?.length ?? 0}`)
    }
    if (!options.offline && chain.length !== 3) {
      throw new Error('Authenticated legacy login requires a three-token chain')
    }

    // The first token is self-signed by the client key carried in its x5u.
    // Its verified payload must advance the chain to Mojang's pinned key.
    let publicKey = getDER(getX5U(chain[0]))
    const mojangKey = getDER(dependencies.mojangPublicKey || constants.PUBLIC_KEY)
    let authenticated = false
    let finalKey
    let data

    for (let index = 0; index < chain.length; index++) {
      const verifyOptions = { algorithms: ['ES384'] }
      if (index > 0) verifyOptions.issuer = 'Mojang'
      data = JWT.verify(chain[index], publicKey, verifyOptions)

      if (!data.identityPublicKey) {
        throw new Error(`Login chain token ${index} is missing identityPublicKey`)
      }
      finalKey = data.identityPublicKey
      publicKey = getDER(finalKey)

      if (index === 0) {
        authenticated = samePublicKey(publicKey, mojangKey)
        if (!options.offline && !authenticated) {
          throw new Error('Legacy login chain is not anchored by Mojang')
        }
      }
    }

    if (!data?.extraData) throw new Error('Legacy login chain is missing identity data')
    if (authenticated && !data.extraData.XUID) {
      throw new Error('Authenticated legacy identity is missing XUID')
    }

    debug('Verified legacy login chain', { authenticated })
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
