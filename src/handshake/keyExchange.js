const JWT = require('jsonwebtoken')
const crypto = require('crypto')

const curve = 'secp384r1'
const pem = { format: 'pem', type: 'sec1' }
const der = { format: 'der', type: 'spki' }

function createKeyExchange (client) {
  const keyPair = crypto.generateKeyPairSync('ec', { namedCurve: curve })
  const publicKeyDER = keyPair.publicKey.export(der)
  const privateKeyPEM = keyPair.privateKey.export(pem)
  const clientX509 = publicKeyDER.toString('base64')

  function parseRemoteKey (value) {
    const key = value instanceof crypto.KeyObject
      ? value
      : crypto.createPublicKey({ key: Buffer.from(value, 'base64'), ...der })
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== curve) {
      throw new Error('Handshake public key must be an EC P-384 key')
    }
    return key
  }

  function deriveEncryption (remotePublicKey, salt) {
    const sharedSecret = crypto.diffieHellman({
      privateKey: keyPair.privateKey,
      publicKey: remotePublicKey
    })
    const secretKeyBytes = crypto.createHash('sha256')
      .update(salt)
      .update(sharedSecret)
      .digest()
    return {
      sharedSecret,
      secretKeyBytes,
      iv: secretKeyBytes.subarray(0, 16)
    }
  }

  function createServerHandshake (clientPublicKey) {
    const remotePublicKey = parseRemoteKey(clientPublicKey)
    const salt = crypto.randomBytes(16)
    const encryption = deriveEncryption(remotePublicKey, salt)
    const token = JWT.sign({
      salt: salt.toString('base64'),
      signedToken: clientX509
    }, keyPair.privateKey, {
      algorithm: 'ES384',
      header: { x5u: clientX509 }
    })
    return { token, ...encryption }
  }

  function verifyServerHandshake (packet) {
    const token = packet?.token
    if (!token) throw new Error('Server did not return a valid JWT, cannot start encryption')

    const decoded = JWT.decode(token, { complete: true })
    const x5u = decoded?.header?.x5u
    if (!x5u) throw new Error('Server handshake JWT is missing its public key')
    const remotePublicKey = parseRemoteKey(x5u)
    // The key is self-declared, so this does not authenticate the server's
    // identity. It does ensure that the key used for ECDH signed the payload.
    const claims = JWT.verify(token, remotePublicKey, { algorithms: ['ES384'] })
    if (!claims?.salt || typeof claims.salt !== 'string') {
      throw new Error('Server handshake JWT is missing its salt')
    }
    const salt = Buffer.from(claims.salt, 'base64')
    if (salt.length === 0 || salt.length > 64) throw new Error('Server handshake salt has an invalid length')
    return deriveEncryption(remotePublicKey, salt)
  }

  client.ecdhKeyPair = keyPair
  client.publicKeyDER = publicKeyDER
  client.privateKeyPEM = privateKeyPEM
  client.clientX509 = clientX509
  client.createServerHandshake = createServerHandshake
  client.verifyServerHandshake = verifyServerHandshake
}

module.exports = { createKeyExchange }
