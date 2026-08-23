const crypto = require('crypto')
const JWT = require('jsonwebtoken')
const UUID = require('uuid-1345')
const constants = require('../handshake/constants')
const { verifyOidcToken } = require('../handshake/oidc')

const publicKeyExport = { format: 'der', type: 'spki' }

class AuthenticationError extends Error {
  constructor (message) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

function parsePublicKey (encoded, label = 'public key') {
  if (typeof encoded !== 'string' || encoded.length === 0) {
    throw new AuthenticationError(`Login ${label} is missing`)
  }

  let key
  try {
    key = crypto.createPublicKey({ key: Buffer.from(encoded, 'base64'), ...publicKeyExport })
  } catch (error) {
    throw new AuthenticationError(`Login ${label} is invalid: ${error.message}`)
  }

  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'secp384r1') {
    throw new AuthenticationError(`Login ${label} must be an EC P-384 key`)
  }
  return key
}

function encodePublicKey (key) {
  return key.export(publicKeyExport).toString('base64')
}

function samePublicKey (left, right) {
  return left.export(publicKeyExport).equals(right.export(publicKeyExport))
}

function protectedHeader (token) {
  const decoded = JWT.decode(token, { complete: true })
  if (!decoded || !decoded.header || typeof decoded.payload !== 'object') {
    throw new AuthenticationError('Invalid login JWT')
  }
  return decoded.header
}

function keyFromX5u (token) {
  return parsePublicKey(protectedHeader(token).x5u, 'JWT x5u public key')
}

function identityFromXuid (xuid) {
  const hash = crypto.createHash('md5').update('pocket-auth-1-xuid:').update(xuid).digest()
  hash[6] = (hash[6] & 0x0f) | 0x30
  hash[8] = (hash[8] & 0x3f) | 0x80
  return UUID.stringify(hash)
}

function validateIdentity (identity, authenticated) {
  if (!identity || typeof identity !== 'object') {
    throw new AuthenticationError('Login identity is missing')
  }
  if (typeof identity.displayName !== 'string' || identity.displayName.length === 0 || identity.displayName.length > 64) {
    throw new AuthenticationError('Login display name must contain between 1 and 64 characters')
  }
  if (typeof identity.identity !== 'string' || !UUID.check(identity.identity) || identity.identity === UUID.nil.ascii) {
    throw new AuthenticationError('Login identity UUID is invalid')
  }
  if (authenticated && (typeof identity.XUID !== 'string' || !/^[1-9][0-9]{0,19}$/.test(identity.XUID))) {
    throw new AuthenticationError('Authenticated login XUID is invalid')
  }
}

function canonicalIdentity (value, authenticated) {
  const identity = {
    ...value,
    XUID: authenticated ? value.XUID : '0'
  }
  validateIdentity(identity, authenticated)
  return identity
}

function createLoginVerifier (options, dependencies = {}) {
  const allowOffline = options.offline === true
  const mojangKey = parsePublicKey(dependencies.mojangPublicKey || constants.PUBLIC_KEY, 'pinned Mojang public key')
  const oidcVerifier = dependencies.verifyOidcToken || verifyOidcToken

  function verifyLegacyChain (chain) {
    if (!Array.isArray(chain) || (chain.length !== 1 && chain.length !== 3)) {
      throw new AuthenticationError(`Unexpected login chain length ${chain?.length ?? 0}`)
    }

    const initialClientKey = keyFromX5u(chain[0])
    const token0 = JWT.verify(chain[0], initialClientKey, { algorithms: ['ES384'] })
    const nextKey = parsePublicKey(token0.identityPublicKey, 'chain token 0 identity public key')

    if (chain.length === 1) {
      if (!allowOffline) throw new AuthenticationError('Offline login is not allowed with authentication enabled')
      const identity = canonicalIdentity(token0.extraData, false)
      return {
        authentication: { authenticated: false, method: 'offline', issuer: null },
        identity,
        clientPublicKey: nextKey,
        clientPublicKeyBase64: encodePublicKey(nextKey)
      }
    }

    if (!samePublicKey(nextKey, mojangKey)) {
      throw new AuthenticationError('Legacy login chain is not anchored by Mojang')
    }

    const token1 = JWT.verify(chain[1], nextKey, { algorithms: ['ES384'], issuer: 'Mojang' })
    const intermediateKey = parsePublicKey(token1.identityPublicKey, 'chain token 1 identity public key')
    const token2 = JWT.verify(chain[2], intermediateKey, { algorithms: ['ES384'], issuer: 'Mojang' })
    const finalClientKey = parsePublicKey(token2.identityPublicKey, 'chain token 2 identity public key')
    const identity = canonicalIdentity(token2.extraData, true)

    return {
      authentication: { authenticated: true, method: 'legacy', issuer: 'Mojang' },
      identity,
      clientPublicKey: finalClientKey,
      clientPublicKeyBase64: encodePublicKey(finalClientKey)
    }
  }

  async function verifyMultiplayerToken (token) {
    const normalized = token.replace(/^MCToken\s+/i, '')
    const header = protectedHeader(normalized)
    const selfSigned = Boolean(header.x5u)
    if (selfSigned && !allowOffline) {
      throw new AuthenticationError('Self-signed multiplayer token is not allowed with authentication enabled')
    }

    const decoded = selfSigned
      ? JWT.verify(normalized, parsePublicKey(header.x5u, 'multiplayer token x5u public key'), { algorithms: ['ES384'] })
      : await oidcVerifier(normalized, options.version)
    if (!decoded || typeof decoded !== 'object') throw new AuthenticationError('Invalid multiplayer token')
    if (!selfSigned && (!Number.isInteger(decoded.exp) || decoded.exp <= 0)) {
      throw new AuthenticationError('OIDC multiplayer token is missing its expiry')
    }

    const authenticated = !selfSigned
    const clientPublicKeyBase64 = decoded.cpk || decoded.clientPublicKey || header.x5u
    const clientPublicKey = parsePublicKey(clientPublicKeyBase64, 'multiplayer token client public key')
    const xuid = decoded.xid || decoded.XUID || decoded.xuid || '0'
    const identity = canonicalIdentity({
      XUID: String(xuid),
      displayName: decoded.xname || decoded.displayName,
      identity: decoded.leguuid || decoded.identity || identityFromXuid(String(xuid)),
      PlayFabID: decoded.mid || decoded.pfbid || decoded.playFabId || decoded.PlayFabID,
      PlayFabTitleID: decoded.tid || decoded.pfbtid || decoded.playFabTitleId || decoded.PlayFabTitleID
    }, authenticated)

    return {
      authentication: {
        authenticated,
        method: authenticated ? 'oidc' : 'offline',
        issuer: authenticated ? decoded.iss : null
      },
      identity,
      clientPublicKey,
      clientPublicKeyBase64: encodePublicKey(clientPublicKey)
    }
  }

  function verifyClientData (token, publicKey) {
    const decoded = JWT.verify(token, publicKey, { algorithms: ['ES384'] })
    if (!decoded || typeof decoded !== 'object') throw new AuthenticationError('Invalid client-data token')
    return decoded
  }

  async function verifyLogin ({ chain, multiplayerToken = '', clientDataToken }) {
    const verifiedIdentity = multiplayerToken
      ? await verifyMultiplayerToken(multiplayerToken)
      : verifyLegacyChain(chain)
    return {
      ...verifiedIdentity,
      clientData: verifyClientData(clientDataToken, verifiedIdentity.clientPublicKey)
    }
  }

  return { verifyLogin }
}

module.exports = {
  AuthenticationError,
  createLoginVerifier,
  identityFromXuid,
  parsePublicKey,
  validateIdentity
}
