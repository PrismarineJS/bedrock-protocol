const { ClientStatus } = require('../connection')
const JWT = require('jsonwebtoken')
const crypto = require('crypto')
const debug = require('debug')('minecraft-protocol')

const SALT = '🧂'
const curve = 'secp384r1'
const pem = { format: 'pem', type: 'sec1' }
const der = { format: 'der', type: 'spki' }

function KeyExchange (client, server, options) {
  // Generate a key pair at program start up
  client.ecdhKeyPair = crypto.generateKeyPairSync('ec', { namedCurve: curve })
  client.publicKeyDER = client.ecdhKeyPair.publicKey.export(der)
  client.privateKeyPEM = client.ecdhKeyPair.privateKey.export(pem)
  client.clientX509 = client.publicKeyDER.toString('base64')

  function startClientboundEncryption (publicKey) {
    debug('[encrypt] Client pub key base64: ', publicKey)

    const pubKeyDer = crypto.createPublicKey({ key: Buffer.from(publicKey.key, 'base64'), ...der })
    // Shared secret from the client's public key + our private key
    client.sharedSecret = crypto.diffieHellman({ privateKey: client.ecdhKeyPair.privateKey, publicKey: pubKeyDer })

    // Secret hash we use for packet encryption:
    // From the public key of the remote and the private key
    // of the local, a shared secret is generated using ECDH.
    // The secret key bytes are then computed as
    // sha256(server_token + shared_secret). These secret key
    //  bytes are 32 bytes long.
    const secretHash = crypto.createHash('sha256')
    secretHash.update(SALT)
    secretHash.update(client.sharedSecret)

    client.secretKeyBytes = secretHash.digest()

    const token = JWT.sign({
      salt: toBase64(SALT),
      signedToken: client.clientX509
    }, client.ecdhKeyPair.privateKey, { algorithm: 'ES384', header: { x5u: client.clientX509 } })

    client.write('server_to_client_handshake', { token })

    // The encryption scheme is AES/CFB8/NoPadding with the
    // secret key being the result of the sha256 above and
    // the IV being the first 16 bytes of this secret key.
    const initial = client.secretKeyBytes.slice(0, 16)
    client.startEncryption(initial)
  }

  function startServerboundEncryption (token) {
    debug('[encrypt] Starting serverbound encryption', token)
    const jwt = token?.token
    if (!jwt) {
      throw Error('Server did not return a valid JWT, cannot start encryption')
    }

    // No verification here, not needed

    const [header, payload] = jwt.split('.').map(k => Buffer.from(k, 'base64'))
    const head = JSON.parse(String(header))
    const body = JSON.parse(String(payload))

    const pubKeyDer = crypto.createPublicKey({ key: Buffer.from(head.x5u, 'base64'), ...der })

    // Shared secret from the client's public key + our private key
    client.sharedSecret = crypto.diffieHellman({ privateKey: client.ecdhKeyPair.privateKey, publicKey: pubKeyDer })

    const salt = Buffer.from(body.salt, 'base64')
    const secretHash = crypto.createHash('sha256')
    secretHash.update(salt)
    secretHash.update(client.sharedSecret)

    client.secretKeyBytes = secretHash.digest()
    const iv = client.secretKeyBytes.slice(0, 16)
    client.startEncryption(iv)

    // It works! First encrypted packet :)

    client.write('client_to_server_handshake', {})
    this.emit('join')
    client.status = ClientStatus.Initializing
  }

  client.on('server.client_handshake', startClientboundEncryption)
  client.on('client.server_handshake', startServerboundEncryption)
}

function toBase64 (string) {
  return Buffer.from(string).toString('base64')
}

module.exports = { KeyExchange }
