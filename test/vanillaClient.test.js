/* eslint-env mocha */
const assert = require('assert')
const http = require('http')
const { once } = require('events')
const { createVanillaClient } = require('../tools/vanillaClient')
const { CURRENT_VERSION } = require('../src/options')

describe('vanilla HTTP signalling', function () {
  this.timeout(5000)
  let server, client
  afterEach(async () => {
    client?.close()
    if (server) {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
  })

  async function setup (handler) {
    server = http.createServer(handler)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    client = createVanillaClient({
      host: '127.0.0.1', port: server.address().port, version: CURRENT_VERSION, username: 'Test', offline: true, transport: 'nethernet'
    })
  }

  it('sends a complete signed offer and reports numeric rejection responses', async () => {
    let request
    let body = ''
    await setup((req, res) => {
      request = req
      req.on('data', data => { body += data })
      req.on('end', () => { res.writeHead(200, { 'content-type': 'application/sdp' }); res.end('37') })
    })
    const failure = once(client, 'error')
    client.connect()
    assert.match((await failure)[0].message, /rejected the offer: 37/)
    assert.strictEqual(request.method, 'POST')
    assert.match(request.url, /^\/v1\/join\/\d+$/)
    assert.strictEqual(request.headers['content-type'], 'application/sdp')
    assert.match(body, /^a=candidate:/m)
    assert.match(body, /^a=identity:/m)
    assert(body.indexOf('a=identity:') < body.indexOf('m='))
    assert.strictEqual(client._closed, true)
  })

  it('aborts an outstanding HTTP exchange when the client closes', async () => {
    await setup(() => {})
    const request = once(server, 'request')
    let errors = 0
    client.on('error', () => { errors++ })
    client.connect()
    const [req, res] = await request
    const disconnected = once(res, 'close')
    req.resume()
    client.close()
    await disconnected
    assert.strictEqual(errors, 0)
  })
})
