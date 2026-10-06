/* eslint-env mocha */
const assert = require('assert')
const { Client } = require('../src/client')
const { Server } = require('../src/server')
const { Relay } = require('../src/relay')
const { createClient } = require('../src/createClient')
const { NethernetClient } = require('../src/nethernet')
const auth = require('../src/client/auth')
const { RealmAPI } = require('prismarine-realms')
const { NethernetSignal } = require('../src/nethernet/signalling')
const { XboxClient } = require('prismarine-xbox-services')
const { EventEmitter } = require('events')
const { CURRENT_VERSION, Versions } = require('../src/options')

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

  it('starts the transport immediately rather than deferring independent connections', () => {
    const client = new Client({ delayedInit: true })
    let started = false
    client.connection = { connect () { started = true }, close () {} }
    client._connect({})
    assert.strictEqual(started, true)
    client.close()
  })

  for (const asynchronous of [false, true]) {
    it(`closes and reports a ${asynchronous ? 'rejected' : 'thrown'} transport startup error`, async () => {
      const client = new Client({ delayedInit: true })
      let closed = false
      const error = new Error('transport startup failed')
      client.connection = {
        connect () { if (asynchronous) return Promise.reject(error); throw error },
        close () { closed = true }
      }
      const failure = new Promise(resolve => client.once('error', resolve))
      client._connect({})
      assert.strictEqual(await failure, error)
      assert.strictEqual(closed, true)
      assert.strictEqual(client._closed, true)
    })
  }

  for (const discovery of ['direct', 'world', 'realm']) {
    it(`skips LAN version discovery for ${discovery} services connections`, async () => {
      let pings = 0
      let initialized = 0
      stub(NethernetClient.prototype, 'ping', async () => { pings++; return {} })
      stub(Client.prototype, 'init', function () { initialized++ })
      const options = { transport: 'nethernet', nethernet: { networkId: 1n, signalling: 'services' } }
      if (discovery !== 'direct') {
        options.nethernet.signalling = 'lan'
        options[discovery === 'realm' ? 'realms' : 'world'] = {}
        const chooseServices = options => { options.nethernet.signalling = 'services' }
        if (discovery === 'realm') stub(auth, 'realmAuthenticate', async options => chooseServices(options))
        else stub(auth, 'worldAuthenticate', async (client, options) => chooseServices(options))
      }
      const client = createClient(options)
      try {
        await new Promise(resolve => setImmediate(resolve))
        assert.strictEqual(initialized, 1)
        assert.strictEqual(pings, 0)
        assert.strictEqual(client._discoveryAbort, undefined)
      } finally {
        client.close()
      }
    })
  }

  for (const version of [undefined, '1.21.0']) {
    it(`falls back after discovery failure, explicit version=${version}`, async () => {
      const initialized = deferred()
      let timeout
      stub(NethernetClient.prototype, 'ping', async value => { timeout = value; throw new Error('discovery expired') })
      stub(Client.prototype, 'init', function () { initialized.resolve(this.options.version) })
      const client = createClient({ transport: 'nethernet', nethernet: { networkId: 1n }, version, pingTimeout: 123, connectTimeout: 456, conLog: null })
      try {
        assert.strictEqual(await initialized.promise, version ?? CURRENT_VERSION)
        assert.strictEqual(timeout, 123)
        assert.strictEqual(client.options.nethernet.signalling, 'lan')
        assert.strictEqual(client._closed, false)
      } finally {
        client.close()
      }
    })
  }

  it('does not initialize a client closed during discovery', async () => {
    const discovery = deferred()
    let initialized = false
    stub(NethernetClient.prototype, 'ping', () => discovery.promise)
    stub(Client.prototype, 'init', () => { initialized = true })
    const client = createClient({ transport: 'nethernet', nethernet: { networkId: 1n }, conLog: null })
    client.close()
    discovery.resolve({ version: 7, gameVersion: '1.21.0' })
    await new Promise(resolve => setImmediate(resolve))
    assert.strictEqual(initialized, false)
  })

  it('reports initialization errors without retrying with the fallback', async () => {
    const failure = new Error('initialization failed')
    let initialized = 0
    stub(NethernetClient.prototype, 'ping', async () => ({ version: 7, gameVersion: '1.21.0' }))
    stub(Client.prototype, 'init', () => { initialized++; throw failure })
    const client = createClient({ transport: 'nethernet', nethernet: { networkId: 1n }, conLog: null })
    assert.strictEqual(await new Promise(resolve => client.once('error', resolve)), failure)
    assert.strictEqual(initialized, 1)
    assert.strictEqual(client._closed, true)
  })

  for (const [version, compression] of [['1.18.0', 'deflate'], ['1.21.0', 'none']]) {
    it(`selects ${compression} compression after discovering ${version}`, async () => {
      const initialized = deferred()
      stub(NethernetClient.prototype, 'ping', async () => ({ version: 7, gameVersion: version, protocol: Versions[version] }))
      stub(Client.prototype, 'connect', function () { initialized.resolve(this.compressionAlgorithm) })
      const client = createClient({ transport: 'nethernet', nethernet: { networkId: 1n }, conLog: null })
      try {
        assert.strictEqual(await initialized.promise, compression)
        assert.strictEqual(client.options.version, version)
      } finally {
        client.close()
      }
    })
  }

  for (const transport of ['raknet', 'nethernet']) {
    for (const [advertised, protocol, explicit, expected] of [
      ['1.26.50', 2193, undefined, '1.26.51'],
      ['9.99.0', Versions['1.21.0'], undefined, '1.21.0'],
      ['9.99.0', 99999, undefined, undefined],
      ['9.99.0', 99999, '1.21.0', '1.21.0'],
      [undefined, undefined, undefined, CURRENT_VERSION]
    ]) {
      it(`selects ${transport} protocol ${protocol}, advertised=${advertised}, override=${explicit}`, async () => {
        const initialized = deferred()
        if (transport === 'raknet') {
          const { RakClient } = require('../src/rak')('raknet-native')
          stub(RakClient.prototype, 'ping', async () => `MCPE;test;${protocol ?? ''};${advertised ?? ''};0;5;1;world;Creative;1;19133;19133;`)
        } else {
          stub(NethernetClient.prototype, 'ping', async () => ({ version: 7, gameVersion: advertised, protocol }))
        }
        let initCalls = 0
        stub(Client.prototype, 'init', function () { initCalls++; initialized.resolve(this.options.version) })
        const client = createClient({ host: '127.0.0.1', transport, version: explicit, ...(transport === 'nethernet' ? { nethernet: { networkId: 1n } } : {}), conLog: null })
        try {
          if (!expected) {
            const error = await new Promise(resolve => client.once('error', resolve))
            assert.match(error.message, /Unsupported server protocol 99999/)
            assert.strictEqual(initCalls, 0)
            assert.strictEqual(client._closed, true)
            return
          }
          assert.strictEqual(await initialized.promise, expected)
          if (transport === 'raknet') assert.strictEqual(client.options.port, 19133)
        } finally {
          client.close()
        }
      })
    }
  }

  it('keeps explicit client ping deadlines independent of connection deadlines', async () => {
    const client = new Client({ delayedInit: true, pingTimeout: 123, connectTimeout: 456 })
    client.connection = { ping: async timeout => timeout, close () {} }
    try {
      assert.strictEqual(await client.ping(), 123)
    } finally {
      client.close()
    }
  })

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

  it('forwards nested Nethernet relay options without sharing mutable settings', async () => {
    stub(Client.prototype, 'connect', function () {})
    const nethernet = Object.freeze({ networkId: 123n, signalling: 'services', signallingConnectTimeout: 1234 })
    const relay = new Relay({ offline: true, destination: { transport: 'nethernet', nethernet } })
    await relay.openUpstreamConnection({ profile: { name: 'test' }, disconnect () {} }, { hash: 'test' })
    const client = relay.upstreams.get('test')
    try {
      assert.deepStrictEqual(client.options.nethernet, nethernet)
      assert.notStrictEqual(client.options.nethernet, nethernet)
      client.options.nethernet.networkId = 456n
      assert.strictEqual(nethernet.networkId, 123n)
    } finally {
      client.close()
    }
  })

  it('cleans up direct clients even before connection, including rejected session teardown', async () => {
    const calls = []
    const client = new Client({ transport: 'nethernet', delayedInit: true })
    client.nethernet = {
      signalling: { destroy: async () => { calls.push('signal') } },
      session: { close: async () => { calls.push('session'); throw new Error('offline') } }
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
      nethernet: { signalling: 'services' },
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
    const client = new Client({ delayedInit: true, transport: 'nethernet', nethernet: { signalling: 'services', signallingConnectTimeout: 1234 } })
    client.connection = { nethernet: { networkId: 1n, handleSignal () {} }, close () {} }
    let connections = 0
    client._connect = () => { connections++ }
    client.connect()
    await client.nethernet.signalling._connecting
    await Promise.resolve()
    client.nethernet.signalling.emit('credentials', [{ urls: 'turn:example.com' }])
    assert.strictEqual(client.nethernet.signalling.timeout, 1234)
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
      const nethernet = Object.freeze({ signalling: 'lan', signallingConnectTimeout: 1234 })
      const options = { version: CURRENT_VERSION, realms: { realmId: 123 }, authflow: {}, nethernet }
      await auth.realmAuthenticate(options)
      if (protocol === 'RAKNET') {
        assert.strictEqual(options.transport, 'raknet')
        assert.strictEqual(options.host, 'example.com')
        assert.strictEqual(options.port, 19132)
        assert.strictEqual(options.nethernet, undefined)
      } else {
        assert.strictEqual(options.transport, 'nethernet')
        assert.strictEqual(options.nethernet.networkId, address)
        assert.strictEqual(options.nethernet.signalling, 'services')
        assert.strictEqual(options.nethernet.signallingConnectTimeout, 1234)
        assert.strictEqual(options.nethernet._signallingProtocol, 'jsonrpc')
        assert.strictEqual(options.nethernet._signallingHost, 'signal-westus.franchise.minecraft-services.net')
      }
    })
  }

  it('joins a selected world using the ready session snapshot and publishes activity', async () => {
    const client = new Client({ transport: 'nethernet', delayedInit: true })
    const handle = { sessionRef: { name: 'world' } }
    let published = false
    let closed = false
    const session = Object.assign(new EventEmitter(), {
      current: { properties: { custom: { SupportedConnections: [{ ConnectionType: 3 }, { ConnectionType: 7, NetherNetId: '18446744073709551615' }] } } },
      setActivity: async () => { published = true },
      close: async () => { closed = true }
    })
    stub(XboxClient.prototype, 'getProfile', async () => ({ xuid: '12345' }))
    stub(XboxClient.prototype, 'getActivityHandles', async xuid => {
      assert.strictEqual(xuid, '12345')
      return [handle]
    })
    stub(XboxClient.prototype, 'joinSession', async (name, { signal }) => {
      assert.strictEqual(name, 'world')
      assert.strictEqual(signal.aborted, false)
      return session
    })
    const options = { authflow: {}, world: { pickSession: sessions => sessions[0] } }
    await auth.worldAuthenticate(client, options)
    assert.strictEqual(options.nethernet.networkId, 18446744073709551615n)
    assert.strictEqual(published, true)
    client.close()
    await client._nethernetCleanup
    assert.strictEqual(closed, true)
  })

  it('binds before publishing a server session, passes the version, and cleans up failed signalling', async () => {
    const calls = []
    stub(Server.prototype, 'listen', async function () {
      calls.push('listen')
      this.transport = { close: () => calls.push('close') }
    })
    stub(XboxClient.prototype, 'createSession', async () => Object.assign(new EventEmitter(), {
      setActivity: async () => { calls.push('publish') },
      close: async () => { calls.push('leave') }
    }))
    stub(NethernetSignal.prototype, 'connect', async function () {
      assert.strictEqual(this.version, CURRENT_VERSION)
      calls.push('signal')
      throw new Error('signalling unavailable')
    })
    const server = require('../src/createServer').createServer({ transport: 'nethernet', nethernet: { signalling: 'services' }, authflow: {} })
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
    let setupSignal
    let closed = false
    stub(XboxClient.prototype, 'createSession', async ({ signal }) => {
      setupSignal = signal
      started.resolve()
      await publication.promise
      return Object.assign(new EventEmitter(), {
        setActivity: async () => { throw new Error('Must not publish after close') },
        close: async () => { closed = true }
      })
    })
    stub(NethernetSignal.prototype, 'connect', async () => { signals++ })
    const server = require('../src/createServer').createServer({ transport: 'nethernet', nethernet: { signalling: 'services' }, authflow: {} })
    await started.promise
    await server.close()
    publication.resolve()
    await new Promise(resolve => setImmediate(resolve))
    assert.strictEqual(signals, 0)
    assert.strictEqual(setupSignal.aborted, true)
    assert.strictEqual(closed, true)
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
    assert.strictEqual((await signal._request('test', {})).ok, true)
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
