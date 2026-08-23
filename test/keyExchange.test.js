/* eslint-env mocha */

const assert = require('assert')
const crypto = require('crypto')
const { EventEmitter } = require('events')
const JWT = require('jsonwebtoken')
const { KeyExchange } = require('../src/handshake/keyExchange')

function publicKeyBase64 (key) {
  return key.export({ format: 'der', type: 'spki' }).toString('base64')
}

function createConnection () {
  const client = new EventEmitter()
  client.write = (name, params) => client.writes.push([name, params])
  client.startEncryption = iv => {
    client.encryptionIv = iv
    client.encryptionEnabled = true
  }
  client.writes = []
  KeyExchange(client)
  return client
}

describe('key exchange', () => {
  it('generates a fresh server salt for every handshake', () => {
    const remote = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' })
    const client = createConnection()

    client.emit('server.client_handshake', { key: publicKeyBase64(remote.publicKey) })
    client.emit('server.client_handshake', { key: publicKeyBase64(remote.publicKey) })

    const salts = client.writes.map(([, packet]) => JWT.decode(packet.token).salt)
    assert.strictEqual(salts.length, 2)
    assert.notStrictEqual(salts[0], salts[1])
    assert.strictEqual(Buffer.from(salts[0], 'base64').length, 16)
    assert.strictEqual(Buffer.from(salts[1], 'base64').length, 16)
  })

  it('verifies the server handshake signature before enabling encryption', () => {
    const server = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' })
    const attacker = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' })
    const serverPublicKey = publicKeyBase64(server.publicKey)
    const salt = crypto.randomBytes(16).toString('base64')
    const forged = JWT.sign({ salt }, attacker.privateKey, {
      algorithm: 'ES384',
      header: { x5u: serverPublicKey, typ: undefined }
    })
    const client = createConnection()
    let joined = false
    client.on('join', () => { joined = true })

    assert.throws(() => client.emit('client.server_handshake', { token: forged }), /invalid signature/)
    assert.strictEqual(client.encryptionEnabled, undefined)
    assert.strictEqual(joined, false)
  })

  it('accepts a correctly self-signed server handshake', () => {
    const server = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' })
    const serverPublicKey = publicKeyBase64(server.publicKey)
    const token = JWT.sign({ salt: crypto.randomBytes(16).toString('base64') }, server.privateKey, {
      algorithm: 'ES384',
      header: { x5u: serverPublicKey, typ: undefined }
    })
    const client = createConnection()
    let joined = false
    client.on('join', () => { joined = true })

    client.emit('client.server_handshake', { token })

    assert.strictEqual(client.encryptionEnabled, true)
    assert.strictEqual(client.writes.at(-1)[0], 'client_to_server_handshake')
    assert.strictEqual(joined, true)
  })
})
