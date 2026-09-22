/* eslint-env mocha */
const assert = require('assert')
const { EventEmitter } = require('events')
const { createClient, ping } = require('../src/createClient')
const { Client } = require('../src/client')
const { RakClient } = require('../src/rak')('raknet-native')
const { NethernetClient } = require('../src/nethernet')

const raknetAd = 'MCPE;test;2193;1.26.50;0;5;1;world;Creative;1;19133;19133;'
const nethernetAd = () => ({ version: 7, protocol: 2193, gameVersion: '1.26.50', networkId: 123n })

describe('automatic transport discovery', () => {
  const restores = []
  function stub (object, key, value) {
    const previous = object[key]
    object[key] = value
    restores.push(() => { object[key] = previous })
  }
  afterEach(() => { while (restores.length) restores.pop()() })

  for (const transport of ['raknet', 'nethernet']) {
    it(`selects ${transport}, resolves the protocol, and cancels the other probe`, async () => {
      const winner = transport === 'raknet' ? RakClient : NethernetClient
      const loser = transport === 'raknet' ? NethernetClient : RakClient
      let cancelled = false
      stub(winner.prototype, 'ping', async () => transport === 'raknet' ? raknetAd : nethernetAd())
      stub(loser.prototype, 'ping', (timeout, { signal }) => new Promise((resolve, reject) => {
        assert.strictEqual(timeout, 1000)
        signal.addEventListener('abort', () => { cancelled = true; reject(signal.reason) }, { once: true })
      }))
      let initialized
      const ready = new Promise(resolve => { initialized = resolve })
      stub(Client.prototype, 'init', function () { initialized(this.options) })
      const client = createClient({ host: '127.0.0.1', conLog: null })
      try {
        const options = await ready
        assert.strictEqual(options.transport, transport)
        assert.strictEqual(options.version, '1.26.51')
        assert.strictEqual(cancelled, true)
        if (transport === 'nethernet') assert.strictEqual(options.nethernet.networkId, 123n)
        else assert.strictEqual(options.port, 19133)
      } finally { client.close() }
    })

    it(`does not probe the other transport when ${transport} is explicit`, async () => {
      let otherPings = 0
      stub(RakClient.prototype, 'ping', async () => { if (transport !== 'raknet') otherPings++; return raknetAd })
      stub(NethernetClient.prototype, 'ping', async () => { if (transport !== 'nethernet') otherPings++; return nethernetAd() })
      assert.strictEqual((await ping({ host: '127.0.0.1', transport })).transport, transport)
      assert.strictEqual(otherPings, 0)
    })
  }

  it('continues after one transport fails', async () => {
    stub(RakClient.prototype, 'ping', async () => { throw new Error('RakNet unavailable') })
    stub(NethernetClient.prototype, 'ping', async () => { await new Promise(resolve => setImmediate(resolve)); return nethernetAd() })
    assert.strictEqual((await ping({ host: '127.0.0.1' })).transport, 'nethernet')
  })

  it('retains both failures when neither transport responds', async () => {
    const errors = [new Error('RakNet failed'), new Error('Nethernet failed')]
    stub(RakClient.prototype, 'ping', async () => { throw errors[0] })
    stub(NethernetClient.prototype, 'ping', async () => { throw errors[1] })
    await assert.rejects(ping({ host: '127.0.0.1' }), error => {
      assert.deepStrictEqual(error.errors, errors)
      return true
    })
  })

  it('keeps the RakNet fallback when both probes fail', async () => {
    stub(RakClient.prototype, 'ping', async () => { throw new Error('unavailable') })
    stub(NethernetClient.prototype, 'ping', async () => { throw new Error('unavailable') })
    let initialized
    const ready = new Promise(resolve => { initialized = resolve })
    stub(Client.prototype, 'init', function () { initialized(this.options) })
    const client = createClient({ host: '127.0.0.1', version: '1.21.0', conLog: null })
    try {
      const options = await ready
      assert.strictEqual(options.transport, 'raknet')
      assert.strictEqual(options.version, '1.21.0')
    } finally { client.close() }
  })

  it('closes both pending probes without initializing a closed client', async () => {
    let initialized = false
    stub(Client.prototype, 'init', () => { initialized = true })
    const client = createClient({ host: '127.0.0.1', port: 1, pingTimeout: 10000, conLog: null })
    client.close()
    await new Promise(resolve => setImmediate(resolve))
    assert.strictEqual(initialized, false)
    assert.strictEqual(client._discoveryAbort, undefined)
  })

  it('rejects unsupported transport names without probing', async () => {
    await assert.rejects(ping({ transport: 'tcp' }), /Unsupported transport/)
  })

  it('cancels both probes with the caller’s abort reason', async () => {
    const controller = new AbortController()
    const error = new Error('caller cancelled discovery')
    const result = ping({ host: '127.0.0.1', port: 1, signal: controller.signal, timeout: 10000 })
    controller.abort(error)
    await assert.rejects(result, e => e === error)
  })

  it('does not create sockets for an already aborted request', async () => {
    const error = new Error('already cancelled')
    await assert.rejects(ping({ signal: AbortSignal.abort(error) }), e => e === error)
  })
})

describe('RakNet ping lifecycle', () => {
  function client () {
    const con = Object.create(RakClient.prototype)
    con.pendingPings = new Set()
    con.raknet = new EventEmitter()
    con.raknet.ping = () => {}
    con.raknet.close = () => {}
    return con
  }

  it('listens before sending and removes listeners after the response', async () => {
    const con = client()
    const extra = Buffer.alloc(2 + Buffer.byteLength(raknetAd))
    extra.writeUInt16BE(extra.length - 2)
    extra.write(raknetAd, 2)
    con.raknet.ping = () => con.raknet.emit('pong', { extra })
    assert.strictEqual(await con.ping(), raknetAd)
    assert.strictEqual(con.raknet.listenerCount('pong'), 0)
    assert.strictEqual(con.pendingPings.size, 0)
  })

  it('ignores empty and non-Bedrock replies until a usable advertisement arrives', async () => {
    const con = client()
    const result = con.ping()
    con.raknet.emit('pong', { extra: Buffer.alloc(0) })
    con.raknet.emit('pong', { extra: Buffer.from('not a Bedrock server') })
    assert.strictEqual(con.pendingPings.size, 1)
    con.raknet.emit('pong', { extra: Buffer.from(raknetAd) })
    assert.strictEqual(await result, raknetAd)
  })

  it('cleans up on timeout', async () => {
    const con = client()
    await assert.rejects(con.ping(5), /Ping timed out/)
    assert.strictEqual(con.pendingPings.size, 0)
    assert.strictEqual(con.raknet.listenerCount('pong'), 0)
  })

  it('cleans up on a socket error', async () => {
    const con = client()
    const error = new Error('socket failed')
    const result = con.ping()
    con.raknet.emit('error', error)
    await assert.rejects(result, e => e === error)
    assert.strictEqual(con.raknet.listenerCount('pong'), 0)
    assert.strictEqual(con.pendingPings.size, 0)
  })

  it('cancels pending discovery on close', async () => {
    const con = client()
    const result = con.ping(10000)
    con.close()
    con.close()
    await assert.rejects(result, /discovery cancelled/)
    assert.strictEqual(con.raknet.listenerCount('pong'), 0)
    await assert.rejects(con.ping(), /client is closed/)
  })
})

// The connection must use the discovered transport, not just return its metadata.
describe('automatic RakNet connection', function () {
  this.timeout(10000)
  it('discovers a local server and logs in without transport or version options', async () => {
    const { Server } = require('../src/server')
    const { getPort } = require('./util')
    const port = await getPort()
    const server = new Server({ host: '127.0.0.1', port, offline: true, version: '1.21.0' })
    let client
    let timer
    try {
      await server.listen()
      await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Automatic RakNet login timed out')), 5000)
        server.on('error', reject)
        server.on('connect', player => player.on('error', reject))
        // A previous client/server can have selected a different RakNet backend.
        require('../src/rak')('jsp-raknet')
        client = createClient({ host: '127.0.0.1', port, offline: true, username: 'DiscoveryTest', conLog: null })
        client.once('error', reject)
        client.once('join', resolve)
      })
      assert.strictEqual(client.options.transport, 'raknet')
      assert.strictEqual(client.options.version, '1.21.0')
    } finally {
      clearTimeout(timer)
      client?.close()
      await server.close()
    }
  })
})
