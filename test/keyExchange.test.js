/* eslint-env mocha */

const assert = require('assert')
const crypto = require('crypto')
const JWT = require('jsonwebtoken')
const KeyExchange = require('../src/handshake/keyExchange')

function publicKeyBase64 (key) {
  return key.export({ format: 'der', type: 'spki' }).toString('base64')
}

function exchange () {
  const client = {}
  KeyExchange(client)
  return client
}

describe('key exchange', () => {
  it('generates a fresh server salt for every handshake', () => {
    const remote = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' })
    const keyExchange = exchange()

    const first = keyExchange.createServerHandshake(remote.publicKey)
    const second = keyExchange.createServerHandshake(remote.publicKey)

    const salts = [first, second].map(handshake => JWT.decode(handshake.token).salt)
    assert.notStrictEqual(salts[0], salts[1])
    assert.strictEqual(Buffer.from(salts[0], 'base64').length, 16)
    assert.strictEqual(Buffer.from(salts[1], 'base64').length, 16)
  })

  it('verifies the server handshake signature before deriving encryption', () => {
    const server = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' })
    const attacker = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' })
    const serverPublicKey = publicKeyBase64(server.publicKey)
    const forged = JWT.sign({ salt: crypto.randomBytes(16).toString('base64') }, attacker.privateKey, {
      algorithm: 'ES384',
      header: { x5u: serverPublicKey, typ: undefined }
    })
    const keyExchange = exchange()

    assert.throws(() => keyExchange.verifyServerHandshake({ token: forged }), /invalid signature/)
  })

  it('derives matching encryption material from a valid handshake', () => {
    const server = exchange()
    const client = exchange()

    const outbound = server.createServerHandshake(client.ecdhKeyPair.publicKey)
    const inbound = client.verifyServerHandshake({ token: outbound.token })

    assert.deepStrictEqual(inbound.secretKeyBytes, outbound.secretKeyBytes)
    assert.deepStrictEqual(inbound.iv, outbound.iv)
    assert.deepStrictEqual(inbound.sharedSecret, outbound.sharedSecret)
  })

  it('rejects oversized handshake salts', () => {
    const server = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' })
    const serverPublicKey = publicKeyBase64(server.publicKey)
    const token = JWT.sign({ salt: crypto.randomBytes(65).toString('base64') }, server.privateKey, {
      algorithm: 'ES384',
      header: { x5u: serverPublicKey, typ: undefined }
    })
    const keyExchange = exchange()

    assert.throws(() => keyExchange.verifyServerHandshake({ token }), /invalid length/)
  })
})
