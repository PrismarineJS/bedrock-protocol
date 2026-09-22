/* eslint-env mocha */
const assert = require('assert')
const crypto = require('crypto')
const { Client } = require('../src/client')
const { CURRENT_VERSION } = require('../src/options')

// Exercise authentication -> transport -> real WebRTC offer without an Xbox account.
describe('Nethernet authenticated identity', function () {
  this.timeout(10000)

  for (const [signalling, online] of [['lan', true], ['lan', false], ['http', true], ['http', false]]) {
    it(`${signalling} offer uses the ${online ? 'authenticated' : 'offline'} identity`, async () => {
      let authenticatedPublicKey
      const token = 'test-multiplayer-token'
      const profile = Buffer.from(JSON.stringify({ extraData: { displayName: 'Test', XUID: '123' } })).toString('base64url')
      const client = new Client({
        transport: 'nethernet',
        nethernet: { networkId: 1n, signalling },
        host: '127.0.0.1',
        version: CURRENT_VERSION,
        username: 'Test',
        offline: !online,
        conLog: null,
        authflow: {
          async getMinecraftBedrockToken (publicKey) {
            authenticatedPublicKey = publicKey
            return { chain: ['unused', `header.${profile}.signature`], token }
          }
        }
      })
      let timer
      try {
        const offer = new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error('No Nethernet offer')), 5000)
          client.on('error', reject)
          client.connection.nethernet.signalHandler = signal => {
            if (signal.type === 'CONNECTREQUEST') resolve(signal.data)
          }
        })
        client.connect()
        const sdp = await offer
        const identityLine = sdp.split(/\r?\n/).find(line => line.startsWith('a=identity:'))
        if (!online && signalling === 'lan') {
          assert.strictEqual(identityLine, undefined)
          return
        }
        assert(identityLine, 'authenticated offer must contain an identity')
        const envelope = JSON.parse(Buffer.from(identityLine.slice('a=identity:'.length), 'base64'))
        const assertion = JSON.parse(envelope.assertion)
        if (online) assert.strictEqual(assertion.token, token)
        else assert.strictEqual(require('jsonwebtoken').decode(assertion.token).cpk, client.clientX509)
        const fingerprints = sdp.split(/\r?\n/).filter(line => line.startsWith('a=fingerprint:')).map(line => {
          const [algorithm, digest] = line.slice('a=fingerprint:'.length).split(' ')
          return { algorithm, digest }
        })
        const [header, detachedPayload, signature] = assertion.fingerprints.split('.')
        assert.strictEqual(detachedPayload, '')
        assert.deepStrictEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'ES384' })
        const payload = Buffer.from(JSON.stringify({ fingerprint: fingerprints })).toString('base64url')
        const publicKey = crypto.createPublicKey({ key: Buffer.from(authenticatedPublicKey ?? client.clientX509, 'base64'), type: 'spki', format: 'der' })
        assert(crypto.verify('SHA384', Buffer.from(`${header}.${payload}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')))
      } finally {
        clearTimeout(timer)
        client.close()
        await client._nethernetCleanup
      }
    })
  }
})
