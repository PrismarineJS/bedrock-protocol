/* eslint-env mocha */

const assert = require('assert')
const { generateKeyPairSync } = require('crypto')
const JWT = require('jsonwebtoken')
const login = require('../src/handshake/login')

function createPayloads (version, protocolVersion) {
  const keyPair = generateKeyPairSync('ec', { namedCurve: 'secp384r1' })
  const client = {
    ecdhKeyPair: keyPair,
    clientX509: keyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    profile: {
      uuid: '00000000-0000-4000-8000-000000000001',
      xuid: '0',
      name: 'OfflinePlayer'
    },
    username: 'OfflinePlayer',
    versionGreaterThanOrEqualTo (minimum) {
      const left = version.split('.').map(Number)
      const right = minimum.split('.').map(Number)
      for (let i = 0; i < Math.max(left.length, right.length); i++) {
        if ((left[i] || 0) !== (right[i] || 0)) return (left[i] || 0) > (right[i] || 0)
      }
      return true
    }
  }
  const options = {
    version,
    protocolVersion,
    deviceOS: 7,
    host: '127.0.0.1',
    port: 19132
  }
  login(client, null, options)
  client.createClientChain(null, true)
  return {
    identity: JWT.decode(client.multiplayerToken),
    clientData: JWT.decode(client.clientUserChain)
  }
}

describe('login payload', () => {
  it('includes current self-signed identity claims', () => {
    const { identity } = createPayloads('1.26.30', 1001)
    assert.strictEqual(identity.cpk.length > 0, true)
    assert.strictEqual(identity.xname, 'OfflinePlayer')
    assert.strictEqual(identity.xid, '0')
    assert.strictEqual(identity.identity, '00000000-0000-4000-8000-000000000001')
    assert.strictEqual(identity.leguuid, identity.identity)
    assert.strictEqual(identity.mid, '')
  })

  it('includes client fields required since Bedrock 1.26.30', () => {
    const { clientData } = createPayloads('1.26.30', 1001)
    assert.strictEqual(clientData.FilterProfanity, false)
    assert.strictEqual(clientData.ClientIsEditorCapable, false)
    assert.strictEqual(clientData.ClientEditorConnectionIntent, 0)
  })

  it('does not add the 1.26.30 client fields to older payloads', () => {
    const { clientData } = createPayloads('1.26.20', 944)
    assert.strictEqual(clientData.FilterProfanity, undefined)
    assert.strictEqual(clientData.ClientIsEditorCapable, undefined)
    assert.strictEqual(clientData.ClientEditorConnectionIntent, undefined)
  })
})
