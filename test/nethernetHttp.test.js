/* eslint-env mocha */
const assert = require('assert')
const http = require('http')
const { once } = require('events')
const { generateKeyPairSync } = require('crypto')
const JWT = require('jsonwebtoken')
const { createClient, ping } = require('../src/createClient')
const { Client } = require('../src/client')
const { verifyServerIdentity } = require('../src/nethernet/identity')
const { signallingUrl } = require('../src/nethernet/http')
const { createVanillaClient } = require('../tools/vanillaClient')
const { CURRENT_VERSION } = require('../src/options')

const keys = generateKeyPairSync('ec', { namedCurve: 'secp384r1' })
const digest = 'AA:BB:CC:DD'
function signedAnswer ({ expiresIn = 60, wrongSigner = false } = {}) {
  const cpk = keys.publicKey.export({ format: 'jwk' })
  const token = JWT.sign({ cpk }, keys.privateKey, { algorithm: 'ES384', expiresIn })
  const signer = wrongSigner ? generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey : keys.privateKey
  const signature = JWT.sign({ fingerprint: [{ algorithm: 'sha-256', digest }] }, signer, { algorithm: 'ES384', noTimestamp: true }).split('.')
  const assertion = JSON.stringify({ token, fingerprints: `${signature[0]}..${signature[2]}` })
  const identity = Buffer.from(JSON.stringify({ idp: { protocol: 'default', domain: 'untrusted-display-name' }, assertion })).toString('base64')
  return `v=0\r\na=fingerprint:sha-256 ${digest}\r\na=identity:${identity}\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n`
}

// Fixtures use real signatures; the public-key pin is independent of token claims.
describe('Nethernet HTTP identity', () => {
  it('verifies signatures, strips the assertion, and keeps the key fingerprint stable across tokens', () => {
    const first = verifyServerIdentity(signedAnswer())
    const second = verifyServerIdentity(signedAnswer({ expiresIn: 120 }))
    assert.match(first.fingerprint, /^sha256:[a-f0-9]{64}$/)
    assert.strictEqual(first.fingerprint, second.fingerprint)
    assert(!first.sdp.includes('a=identity:'))
    assert(first.sdp.includes(`a=fingerprint:sha-256 ${digest}`))
  })
  for (const [name, change] of [
    ['missing assertion', sdp => sdp.replace(/^a=identity:.*\r\n/m, '')],
    ['duplicate assertion', sdp => sdp + sdp.match(/^a=identity:.*$/m)[0]],
    ['changed DTLS fingerprint', sdp => sdp.replace(digest, '01:02:03:04')],
    ['missing DTLS fingerprint', sdp => sdp.replace(/^a=fingerprint:.*\r\n/m, '')],
    ['expired token', () => signedAnswer({ expiresIn: -60 })],
    ['wrong fingerprint signer', () => signedAnswer({ wrongSigner: true })]
  ]) {
    it(`rejects ${name}`, () => assert.throws(() => verifyServerIdentity(change(signedAnswer()))))
  }
})

describe('Nethernet HTTP discovery and trust', function () {
  this.timeout(10000)
  let server, client
  const originalInit = Client.prototype.init
  const originalFetch = fetch
  afterEach(async () => {
    Client.prototype.init = originalInit
    global.fetch = originalFetch
    client?.close()
    client = undefined
    if (server) {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
      server = undefined
    }
  })
  async function listen (handler) {
    server = http.createServer(handler)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    return { host: '127.0.0.1', port: server.address().port, nethernet: { signalling: 'http' } }
  }

  it('resolves HTTP protocol 2193 to 1.26.51 despite the displayed version', async () => {
    const options = await listen((req, res) => res.end(JSON.stringify({ name: 'HTTP server', protocol: 2193, version: '1.26.50' })))
    const initialized = new Promise(resolve => { Client.prototype.init = function () { resolve(this.options) } })
    client = createClient({ ...options, conLog: null })
    const config = await initialized
    assert.strictEqual(config.version, '1.26.51')
    assert.strictEqual(config.transport, 'nethernet')
    assert.strictEqual(config.nethernet.signalling, 'http')
  })

  it('falls back from UDP to HTTP without inventing missing metadata', async () => {
    const options = await listen((req, res) => res.end())
    delete options.nethernet
    const ad = await ping({ ...options, timeout: 100 })
    assert.strictEqual(ad.signalling, 'http')
    assert.strictEqual(ad.protocol, undefined)
    assert.strictEqual(ad.gameVersion, undefined)
    assert.strictEqual(ad.networkId, undefined)
  })

  it('keeps an explicit LAN choice without attempting HTTP', async () => {
    let requests = 0
    const options = await listen((req, res) => { requests++; res.end() })
    await assert.rejects(ping({ ...options, nethernet: { signalling: 'lan' }, timeout: 50 }), /Ping timed out/)
    assert.strictEqual(requests, 0)
  })

  it('aborts HTTP discovery with the caller’s reason', async () => {
    const options = await listen(() => {})
    const controller = new AbortController()
    const pending = ping({ ...options, signal: controller.signal })
    await once(server, 'request')
    const reason = new Error('cancel HTTP discovery')
    controller.abort(reason)
    await assert.rejects(pending, error => error === reason)
  })

  it('does not follow discovery redirects', async () => {
    const options = await listen((req, res) => {
      res.writeHead(302, { location: '/elsewhere' })
      res.end()
    })
    await assert.rejects(ping(options), /fetch failed/)
  })

  it('constructs IPv6 URLs and rejects non-HTTP origins', () => {
    assert.strictEqual(signallingUrl({ host: '::1', port: 19132 }).href, 'http://[::1]:19132/v1/join')
    assert.throws(() => signallingUrl({ nethernet: { url: 'ftp://example.com' } }), /HTTP\(S\) origin/)
    assert.throws(() => signallingUrl({ nethernet: { url: 'https://example.com/path' } }), /HTTP\(S\) origin/)
  })

  it('bounds an approval callback that never finishes', async () => {
    const options = await listen((req, res) => { req.resume(); res.end(signedAnswer()) })
    let prompted
    const prompt = new Promise(resolve => { prompted = resolve })
    options.nethernet.signallingConnectTimeout = 1500
    options.nethernet.onServerKey = () => { prompted(); return new Promise(() => {}) }
    client = createVanillaClient({ ...options, version: CURRENT_VERSION, offline: true, username: 'Test', connectTimeout: 5000, conLog: null })
    const failure = once(client, 'error')
    client.connect()
    await prompt
    assert.strictEqual((await failure)[0].name, 'TimeoutError')
    assert.strictEqual(client._closed, true)
  })

  it('does not apply an answer approved after the client closes', async () => {
    const options = await listen((req, res) => { req.resume(); res.end(signedAnswer()) })
    let approve, prompted
    const prompt = new Promise(resolve => { prompted = resolve })
    options.nethernet.onServerKey = () => { prompted(); return new Promise(resolve => { approve = resolve }) }
    client = createVanillaClient({ ...options, version: CURRENT_VERSION, offline: true, username: 'Test', conLog: null })
    let applied = false
    client.connection.nethernet.handleAnswer = async () => { applied = true }
    client.on('error', error => { throw error })
    client.connect()
    await prompt
    client.close()
    approve(true)
    await new Promise(resolve => setImmediate(resolve))
    assert.strictEqual(applied, false)
  })

  for (const valid of [true, false]) {
    it(`checks the identity on HTTPS even with TLS trust (${valid ? 'valid' : 'invalid'} signature)`, async () => {
      global.fetch = async () => new Response(signedAnswer({ wrongSigner: !valid }))
      client = createVanillaClient({
        host: '127.0.0.1',
        version: CURRENT_VERSION,
        offline: true,
        username: 'Test',
        conLog: null,
        nethernet: {
          url: 'https://server.example.com',
          onServerKey: () => { throw new Error('HTTPS must not prompt for an unknown key') }
        }
      })
      const received = new Promise(resolve => { client.connection.nethernet.handleAnswer = async ({ data }) => resolve(data) })
      const failure = once(client, 'error')
      client.connect()
      if (valid) assert(!(await received).includes('a=identity:'))
      else assert.match((await failure)[0].message, /invalid signature/)
    })
  }

  for (const policy of ['unknown', 'pinned', 'wrong-pin', 'approve', 'deny']) {
    it(`handles the ${policy} server-key policy before applying the SDP`, async () => {
      const answer = signedAnswer()
      const fingerprint = verifyServerIdentity(answer).fingerprint
      const options = await listen((req, res) => { req.resume(); res.end(answer) })
      let approvals = 0
      options.nethernet.serverKey = policy === 'pinned' ? fingerprint : policy === 'wrong-pin' ? 'sha256:wrong' : undefined
      options.nethernet.onServerKey = policy === 'unknown' ? undefined : async key => { approvals++; assert.strictEqual(key, fingerprint); return policy !== 'deny' }
      client = createVanillaClient({ ...options, version: CURRENT_VERSION, offline: true, username: 'Test', conLog: null })
      const received = new Promise(resolve => { client.connection.nethernet.handleAnswer = async ({ data }) => resolve(data) })
      const failure = once(client, 'error')
      client.connect()
      if (policy === 'pinned' || policy === 'approve') {
        const sdp = await received
        assert(!sdp.includes('a=identity:'))
        assert.strictEqual(approvals, policy === 'approve' ? 1 : 0)
      } else {
        assert.match((await failure)[0].message, /Untrusted Nethernet server key/)
        assert.strictEqual(approvals, policy === 'deny' ? 1 : 0)
      }
    })
  }
})
