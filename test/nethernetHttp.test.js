/* eslint-env mocha */
const assert = require('assert')
const http = require('http')
const { once } = require('events')
const { createClient, ping } = require('../src/createClient')
const { Client } = require('../src/client')

describe('Nethernet HTTP discovery integration', function () {
  this.timeout(10000)
  let server, client
  const originalInit = Client.prototype.init
  afterEach(async () => {
    Client.prototype.init = originalInit
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
})
