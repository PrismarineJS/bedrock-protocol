/* eslint-env mocha */
const assert = require('assert')
const { EventEmitter } = require('events')
const { SignalStructure } = require('node-nethernet')
const { parseJson, parseSignalMessage, parseJsonRpcReceiveItem, encodeSignal } = require('../src/nethernet/signallingCodec')
const { NethernetSignal } = require('../src/nethernet/signalling')
const { NethernetClient } = require('../src/nethernet')
const { Rest } = require('../src/xsapi/rest')
const { Client } = require('../src/client')
const { Server } = require('../src/server')
const { createClient } = require('../src/createClient')
const { NethernetServerAdvertisement } = require('../src/nethernet/advertisement')
const { CURRENT_VERSION } = require('../src/options')

const tick = () => new Promise(resolve => setImmediate(resolve))

describe('Nethernet signalling codec', () => {
  it('preserves a numeric uint64 legacy sender ID', () => {
    const signal = new NethernetSignal(1n, {})
    let received
    signal.on('signal', data => { received = data })
    signal.onMessage('{"Type":1,"From":18446744073709551615,"Message":"CONNECTRESPONSE 123 answer"}')
    assert.strictEqual(received.networkId, '18446744073709551615')
  })

  it('preserves numeric IDs in nested JSON-RPC payloads', () => {
    const message = '{"params":{"netherNetId":18446744073709551615,"message":"CONNECTRESPONSE 123 answer"}}'
    assert.strictEqual(parseSignalMessage(message).networkId, '18446744073709551615')
    const item = parseJson('{"fromPlayerId":18446744073709551615,"message":"CONNECTRESPONSE 123 answer"}')
    assert.strictEqual(parseJsonRpcReceiveItem(item).networkId, '18446744073709551615')
  })

  it('keeps UUID-style IDs intact and serializes legacy integers losslessly', () => {
    const signal = new SignalStructure('CONNECTREQUEST', 123n, 'offer', '18446744073709551615')
    const legacy = encodeSignal(signal, 1n, 'legacy')
    assert(legacy.includes('"To":18446744073709551615'))
    assert.strictEqual(parseJson(legacy).To, signal.networkId)
    signal.networkId = 'realm-uuid'
    const rpc = JSON.parse(encodeSignal(signal, 18446744073709551615n, 'jsonrpc', 'request-id', 'message-id'))
    assert.strictEqual(rpc.params.toPlayerId, 'realm-uuid')
    assert.strictEqual(JSON.parse(rpc.params.message).params.netherNetId, '18446744073709551615')
  })
})

describe('Xbox HTTP requests', () => {
  let originalFetch
  const auth = { getXboxToken: async () => ({ userHash: 'hash', XSTSToken: 'test-token' }) }
  beforeEach(() => { originalFetch = global.fetch })
  afterEach(() => { global.fetch = originalFetch })

  it('accepts empty successful responses, including 204', async () => {
    for (const status of [200, 204]) {
      global.fetch = async () => new Response(null, { status })
      assert.strictEqual(await new Rest(auth).get('https://example.com'), undefined)
    }
  })

  it('sets JSON headers and preserves IDs and falsy request bodies', async () => {
    global.fetch = async (url, request) => {
      assert.strictEqual(request.headers['content-type'], 'application/json')
      assert.strictEqual(request.headers.accept, 'application/json')
      assert.strictEqual(request.headers['x-xbl-contract-version'], '107')
      assert.strictEqual(request.body, 'false')
      return new Response('{"id":18446744073709551615}')
    }
    const response = await new Rest(auth).post('https://example.com', { data: false, contractVersion: '107' })
    assert.strictEqual(response.id, '18446744073709551615')
  })

  it('surfaces unsuccessful HTTP status and malformed JSON', async () => {
    global.fetch = async () => new Response('unavailable', { status: 503 })
    await assert.rejects(new Rest(auth).get('https://example.com'), /503.*unavailable/)
    global.fetch = async () => new Response('{')
    await assert.rejects(new Rest(auth).get('https://example.com'))
  })

  it('bounds pending authentication and never fetches after a timeout', async () => {
    let resolveToken
    let fetched = false
    global.fetch = async () => { fetched = true }
    const pendingAuth = { getXboxToken: () => new Promise(resolve => { resolveToken = resolve }) }
    const rest = new Rest(pendingAuth, { timeout: 10 })
    await assert.rejects(rest.get('https://example.com'), /timed out/)
    resolveToken(await auth.getXboxToken())
    await tick()
    assert.strictEqual(fetched, false)
    assert.strictEqual(rest.requests.size, 0)
  })

  it('bounds response-body reading and aborts the fetch signal', async () => {
    let signal
    global.fetch = async (url, request) => {
      signal = request.signal
      return { ok: true, text: () => new Promise(() => {}) }
    }
    await assert.rejects(new Rest(auth, { timeout: 10 }).get('https://example.com'), /timed out/)
    assert.strictEqual(signal.aborted, true)
  })

  it('cancels active requests without preventing subsequent session cleanup requests', async () => {
    global.fetch = () => new Promise(() => {})
    const rest = new Rest(auth)
    const request = assert.rejects(rest.get('https://example.com'), /cancelled/)
    rest.abortPending()
    await request
    global.fetch = async () => new Response(null, { status: 204 })
    await rest.leaveSession('world')
    assert.strictEqual(rest.requests.size, 0)
  })

  it('honors caller cancellation before and during a request', async () => {
    for (const beforehand of [true, false]) {
      const controller = new AbortController()
      global.fetch = () => new Promise(() => {})
      if (beforehand) controller.abort(new Error('caller cancelled'))
      const request = assert.rejects(new Rest(auth).get('https://example.com', { signal: controller.signal }), /caller cancelled/)
      if (!beforehand) controller.abort(new Error('caller cancelled'))
      await request
    }
  })
})

function discoveryClient () {
  const client = Object.create(NethernetClient.prototype)
  client.nethernet = new EventEmitter()
  client.nethernet.serverNetworkId = 123n
  client.nethernet.ping = () => {}
  client.nethernet.close = () => {}
  client.pendingPings = new Set()
  client.closed = false
  return client
}

function assertNoDiscoveryListeners (client) {
  assert.strictEqual(client.nethernet.listenerCount('pong'), 0)
  assert.strictEqual(client.nethernet.listenerCount('error'), 0)
  assert.strictEqual(client.pendingPings.size, 0)
}

describe('Nethernet discovery lifecycle', () => {
  it('listens before sending and ignores other servers', async () => {
    const client = discoveryClient()
    client.nethernet.ping = () => {
      client.nethernet.emit('pong', { sender_id: 999n, data: 'wrong' })
      client.nethernet.emit('pong', { sender_id: 123n, data: new NethernetServerAdvertisement({ motd: 'right' }).toBuffer().toString('hex') })
    }
    assert.strictEqual((await client.ping()).motd, 'right')
    assertNoDiscoveryListeners(client)
  })

  it('ignores unreadable replies and accepts a subsequent valid reply', async () => {
    const client = discoveryClient()
    client.nethernet.ping = () => {
      for (const data of ['', '08', '0705ff']) {
        assert.doesNotThrow(() => client.nethernet.emit('pong', { sender_id: 123n, data }))
      }
      client.nethernet.emit('pong', { sender_id: 123n, data: new NethernetServerAdvertisement().toBuffer().toString('hex') })
    }
    assert.strictEqual((await client.ping()).version, 7)
    assertNoDiscoveryListeners(client)
  })

  it('times out normally if only unreadable replies arrive', async () => {
    const client = discoveryClient()
    client.nethernet.ping = () => client.nethernet.emit('pong', { sender_id: 123n, data: '08' })
    await assert.rejects(client.ping(10), /Ping timed out/)
    assertNoDiscoveryListeners(client)
  })

  for (const reason of ['timeout', 'abort', 'close', 'error', 'throw']) {
    it(`removes response listeners on ${reason}`, async () => {
      const client = discoveryClient()
      const controller = new AbortController()
      if (reason === 'throw') client.nethernet.ping = () => { throw new Error('send failed') }
      const ping = assert.rejects(client.ping(10, { signal: controller.signal }))
      if (reason === 'abort') controller.abort()
      if (reason === 'close') client.close()
      if (reason === 'error') client.nethernet.emit('error', new Error('socket failed'))
      await ping
      assertNoDiscoveryListeners(client)
    })
  }
})

describe('Nethernet advertisement integration', () => {
  it('advertises the authentication modes the server actually accepts', () => {
    for (const offline of [true, false]) {
      const server = new Server({ transport: 'nethernet', offline })
      const ad = server.getAdvertisement()
      assert.strictEqual(ad.acceptsSelfSignedAuth, offline)
      assert.strictEqual(ad.acceptsOnlineAuth, true)
    }
  })

  for (const [layout, explicit, expected] of [[7, undefined, '1.21.0'], [7, CURRENT_VERSION, CURRENT_VERSION], [4, undefined, CURRENT_VERSION]]) {
    it(`selects a game version for layout ${layout}, explicit=${explicit}`, async () => {
      const originalPing = NethernetClient.prototype.ping
      const originalInit = Client.prototype.init
      let client
      try {
        NethernetClient.prototype.ping = async () => new NethernetServerAdvertisement({ version: layout }, '1.21.0')
        const initialized = new Promise(resolve => { Client.prototype.init = function () { resolve(this.options.version) } })
        client = createClient({ transport: 'nethernet', networkId: 123n, ...(explicit ? { version: explicit } : {}), conLog: null })
        assert.strictEqual(await initialized, expected)
      } finally {
        client?.close()
        NethernetClient.prototype.ping = originalPing
        Client.prototype.init = originalInit
      }
    })
  }
})
