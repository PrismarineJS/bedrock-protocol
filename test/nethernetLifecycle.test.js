/* eslint-env mocha */
const assert = require('assert')
const { Client } = require('../src/client')
const { Server } = require('../src/server')
const { Relay } = require('../src/relay')
const { createClient } = require('../src/createClient')
const auth = require('../src/client/auth')
const { RealmAPI } = require('prismarine-realms')
const { NethernetSignal } = require('../src/websocket/signal')
const { SessionDirectory } = require('../src/xsapi/session')
const { CURRENT_VERSION } = require('../src/options')

function deferred () {
  let resolvePromise
  const promise = new Promise(resolve => { resolvePromise = resolve })
  return { promise, resolve: resolvePromise }
}

// The real lifecycle and option handling run against stubbed transport/auth edges.
// No Xbox account or external service is needed for these regressions.
describe('nethernet lifecycle and RakNet compatibility', () => {
  const restores = []
  function stub (object, key, value) {
    const old = object[key]
    object[key] = value
    restores.push(() => { object[key] = old })
  }
  afterEach(() => { while (restores.length) restores.pop()() })

  it('closes a factory RakNet client once and releases its transport', () => {
    let closed = 0
    stub(Client.prototype, 'init', function () {
      this.connection = { close: () => { closed++ } }
      this.emit('connect_allowed')
    })
    stub(Client.prototype, 'connect', function () {})
    const client = createClient({ host: 'localhost', skipPing: true })
    client.close()
    client.close()
    assert.strictEqual(closed, 1)
  })

  it('closes a factory RakNet server once and releases its transport', async () => {
    let closed = 0
    stub(Server.prototype, 'listen', async function () {
      this.transport = { close: () => { closed++ } }
    })
    const server = require('../src/createServer').createServer({ host: 'localhost' })
    await Promise.all([server.close(), server.close()])
    assert.strictEqual(closed, 1)
  })

  it('waits for a pending server bind before closing its transport once', async () => {
    const bound = deferred()
    const server = new Server({ host: 'localhost' })
    let closed = 0
    server.transportServer = class {
      listen () { return bound.promise }
      close () { closed++ }
    }
    const listening = server.listen()
    const closing = server.close()
    bound.resolve()
    await Promise.all([listening, closing])
    assert.strictEqual(closed, 1)
    assert.strictEqual(server.serverTimer, undefined)
  })

  it('keeps the RakNet default for relay destinations without a transport', async () => {
    stub(Client.prototype, 'connect', function () {})
    const relay = new Relay({ offline: true, destination: { host: 'localhost', port: 19132 } })
    await relay.openUpstreamConnection({ profile: { name: 'test' }, disconnect () {} }, { hash: 'test' })
    const client = relay.upstreams.get('test')
    assert.strictEqual(client.options.transport, 'raknet')
    client.close()
  })

  it('cleans up direct clients even before connection, including rejected session teardown', async () => {
    const calls = []
    const client = new Client({ transport: 'nethernet', delayedInit: true })
    client.nethernet = {
      signalling: { destroy: async () => { calls.push('signal') } },
      session: { end: async () => { calls.push('session'); throw new Error('offline') } }
    }
    client.close()
    client.close()
    await client._nethernetCleanup
    assert.deepStrictEqual(calls.sort(), ['session', 'signal'])
  })

  it('routes signalling authentication failures to the client and closes it', async () => {
    stub(auth, 'authenticate', client => client.emit('session', {}))
    const client = new Client({
      delayedInit: true,
      transport: 'nethernet',
      useSignalling: true,
      authflow: { getMinecraftBedrockServicesToken: async () => { throw new Error('token unavailable') } }
    })
    let closed = false
    client.connection = { nethernet: { networkId: 1n, handleSignal () {} }, close: () => { closed = true } }
    const error = new Promise(resolve => client.once('error', resolve))
    client.connect()
    assert.match((await error).message, /token unavailable/)
    assert.strictEqual(closed, true)
    await client._nethernetCleanup
  })

  it('does not start a second transport connection when signalling credentials refresh', async () => {
    stub(auth, 'authenticate', client => client.emit('session', {}))
    stub(NethernetSignal.prototype, 'init', async function () { this.emit('credentials', []) })
    const client = new Client({ delayedInit: true, transport: 'nethernet', useSignalling: true })
    client.connection = { nethernet: { networkId: 1n, handleSignal () {} }, close () {} }
    let connections = 0
    client._connect = () => { connections++ }
    client.connect()
    await client.nethernet.signalling._connecting
    await Promise.resolve()
    client.nethernet.signalling.emit('credentials', [{ urls: 'turn:example.com' }])
    assert.strictEqual(connections, 1)
    assert.deepStrictEqual(client.connection.nethernet.credentials, [{ urls: 'turn:example.com' }])
    client.close()
    await client._nethernetCleanup
  })

  for (const [protocol, address] of [['RAKNET', 'example.com:19132'], ['NETHERNET_JSONRPC', 'realm-network-id']]) {
    it(`retains the connection information from a ${protocol} Realm`, async () => {
      stub(RealmAPI, 'from', () => ({
        getRealms: async () => [{ id: 123 }],
        rest: { get: async () => ({ address, networkProtocol: protocol, sessionRegionData: { regionName: 'WestUS' } }) }
      }))
      const options = { version: CURRENT_VERSION, realms: { realmId: 123 }, authflow: {} }
      await auth.realmAuthenticate(options)
      if (protocol === 'RAKNET') {
        assert.strictEqual(options.transport, 'raknet')
        assert.strictEqual(options.host, 'example.com')
        assert.strictEqual(options.port, 19132)
      } else {
        assert.strictEqual(options.transport, 'nethernet')
        assert.strictEqual(options.networkId, address)
        assert.strictEqual(options.skipPing, true)
        assert.strictEqual(options.useSignalling, true)
        assert.strictEqual(options._signallingProtocol, 'jsonrpc')
        assert.strictEqual(options._signallingHost, 'signal-westus.franchise.minecraft-services.net')
      }
    })
  }

  it('binds before publishing a server session, passes the version, and cleans up failed signalling', async () => {
    const calls = []
    stub(Server.prototype, 'listen', async function () {
      calls.push('listen')
      this.transport = { close: () => calls.push('close') }
    })
    stub(SessionDirectory.prototype, 'createSession', async () => { calls.push('publish') })
    stub(SessionDirectory.prototype, 'end', async () => { calls.push('leave') })
    stub(NethernetSignal.prototype, 'connect', async function () {
      assert.strictEqual(this.version, CURRENT_VERSION)
      calls.push('signal')
      throw new Error('signalling unavailable')
    })
    const server = require('../src/createServer').createServer({ transport: 'nethernet', useSignalling: true, authflow: {} })
    const error = await new Promise(resolve => server.once('error', resolve))
    assert.match(error.message, /signalling unavailable/)
    await server.close()
    assert.deepStrictEqual(calls.slice(0, 3), ['listen', 'publish', 'signal'])
    assert(calls.includes('leave'))
    assert(calls.includes('close'))
  })

  it('does not start server signalling after closing during session publication', async () => {
    const publication = deferred()
    const started = deferred()
    let signals = 0
    stub(Server.prototype, 'listen', async function () { this.transport = { close () {} } })
    stub(SessionDirectory.prototype, 'createSession', async () => { started.resolve(); await publication.promise })
    stub(SessionDirectory.prototype, 'end', async () => {})
    stub(NethernetSignal.prototype, 'connect', async () => { signals++ })
    const server = require('../src/createServer').createServer({ transport: 'nethernet', useSignalling: true, authflow: {} })
    await started.promise
    await server.close()
    publication.resolve()
    await new Promise(resolve => setImmediate(resolve))
    assert.strictEqual(signals, 0)
  })

  it('terminates a lost Xbox session and reports the failure instead of calling a nonexistent restart', async () => {
    const session = new SessionDirectory({})
    session.session.name = 'joined-world'
    let destroyed = false
    let left = false
    session.host.rta = { destroy: async () => { destroyed = true } }
    session.host.rest.updateConnection = async () => { throw new Error('session gone') }
    session.host.rest.leaveSession = async () => { left = true }
    let failure
    session.on('error', error => { failure = error })
    await session.host.onSubscribe({ data: { ConnectionId: 'new-connection' } })
    assert.strictEqual(destroyed, true)
    assert.strictEqual(left, true)
    assert.match(failure.message, /session connection was lost/)
    await assert.rejects(session.joinSession('another-world'), /session is closed/)
  })
})

describe('Nethernet signalling lifecycle', () => {
  it('rejects token failures without waiting forever for credentials', async () => {
    const signal = new NethernetSignal(1n, { getMinecraftBedrockServicesToken: async () => { throw new Error('token failed') } })
    await assert.rejects(signal.connect(), /token failed/)
    assert.strictEqual(signal._closed, true)
  })

  it('times out a signalling connection that never delivers credentials', async () => {
    const signal = new NethernetSignal(1n, {}, undefined, { timeout: 10 })
    signal.init = async () => {}
    await assert.rejects(signal.connect(), /timed out/)
    assert.strictEqual(signal._closed, true)
  })

  it('rejects a normal close before JSON-RPC credentials arrive', async () => {
    const signal = new NethernetSignal(1n, {}, undefined, { protocol: 'jsonrpc' })
    signal.init = async () => signal.onClose(1000, 'closed')
    await assert.rejects(signal.connect(), /connection closed/)
  })

  it('cancels pending authentication without opening a late socket', async () => {
    const token = deferred()
    const signal = new NethernetSignal(1n, { getMinecraftBedrockServicesToken: () => token.promise })
    const connecting = assert.rejects(signal.connect(), /cancelled/)
    await signal.destroy()
    token.resolve({ mcToken: 'test' })
    await connecting
    await Promise.resolve()
    assert.strictEqual(signal.ws, null)
  })

  it('closes connecting sockets and rejects all pending requests on destroy', async () => {
    const signal = new NethernetSignal(1n, {})
    let terminated = 0
    signal.ws = { readyState: 1, send () {}, terminate () { terminated++ } }
    const request = assert.rejects(signal._request('test', {}), /connection closed/)
    signal.ws.readyState = 0
    await signal.destroy()
    await request
    await signal.destroy()
    assert.strictEqual(terminated, 1)
    assert.strictEqual(signal._pendingRequests.size, 0)
  })

  it('registers a request before sending and resolves JSON-RPC replies', async () => {
    const signal = new NethernetSignal(1n, {})
    signal.ws = {
      readyState: 1,
      terminate () {},
      send (data) {
        const request = JSON.parse(data)
        signal.onMessage(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { ok: true } }))
      }
    }
    assert.deepStrictEqual(await signal._request('test', {}), { ok: true })
    await signal.destroy()
  })

  it('falls back once from legacy to JSON-RPC and settles the original connection', async () => {
    const signal = new NethernetSignal(1n, {})
    let attempts = 0
    signal.init = async () => {
      if (++attempts === 1) signal.onClose(1006, 'legacy unavailable')
      else signal.onMessage(JSON.stringify({ Type: 2, From: 'Server', Message: '{"TurnAuthServers":[]}' }))
    }
    await signal.connect()
    assert.strictEqual(signal._protocol, 'jsonrpc')
    assert.strictEqual(attempts, 2)
    await signal.destroy()
  })

  it('updates TURN credentials from JSON-RPC and routes received signals', async () => {
    const signal = new NethernetSignal(1n, {}, undefined, { protocol: 'jsonrpc' })
    const sent = []
    signal.ws = {
      readyState: 1,
      terminate () {},
      send (data) {
        const request = JSON.parse(data)
        sent.push(request)
        if (request.method === 'Signaling_TurnAuth_v1_0') {
          signal.onMessage(JSON.stringify({
            jsonrpc: '2.0',
            id: request.id,
            result: { TurnAuthServers: [{ Urls: ['turn:example.com'], Username: 'user', Password: 'secret' }] }
          }))
        }
      }
    }
    await signal._requestTurnAuth()
    assert.deepStrictEqual(signal.credentials, [{ urls: ['turn:example.com'], username: 'user', credential: 'secret' }])
    let received
    signal.on('signal', value => { received = value })
    signal.onMessage(JSON.stringify({
      jsonrpc: '2.0',
      id: 'delivery',
      method: 'Signaling_ReceiveMessage_v1_0',
      params: {
        message: JSON.stringify({
          jsonrpc: '2.0',
          method: 'Signaling_WebRtc_v1_0',
          params: { netherNetId: '18446744073709551615', message: 'CONNECTRESPONSE 123 answer' }
        })
      }
    }))
    assert.strictEqual(received.networkId, '18446744073709551615')
    assert.strictEqual(received.connectionId, 123n)
    assert.strictEqual(received.data, 'answer')
    assert.deepStrictEqual(sent.at(-1), { jsonrpc: '2.0', id: 'delivery', result: null })
    await signal.destroy()
  })

  it('bounds reconnects that never obtain new credentials', async () => {
    const signal = new NethernetSignal(1n, {}, undefined, { protocol: 'jsonrpc', timeout: 10 })
    signal.init = async () => {}
    const failed = new Promise(resolve => signal.once('error', resolve))
    signal.onClose(1006, 'lost')
    assert.match((await failed).message, /reconnect timed out/)
    assert.strictEqual(signal._closed, true)
  })

  it('reports exhausted retries through error instead of throwing in the close callback', async () => {
    const signal = new NethernetSignal(1n, {}, undefined, { protocol: 'jsonrpc' })
    signal.retryCount = 5
    let failure
    signal.on('error', error => { failure = error })
    assert.doesNotThrow(() => signal.onClose(1006, 'lost'))
    assert.match(failure.message, /closed unexpectedly/)
    assert.strictEqual(signal._closed, true)
  })
})
