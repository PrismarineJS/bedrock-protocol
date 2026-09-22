/* eslint-env mocha */
const assert = require('assert')
const { EventEmitter } = require('events')
const { SignalStructure } = require('nethernet')
const { parseJson, parseSignalMessage, parseJsonRpcReceiveItem, encodeSignal } = require('../src/nethernet/signallingCodec')
const { NethernetSignal } = require('../src/nethernet/signalling')
const { NethernetClient } = require('../src/nethernet')
const { Client } = require('../src/client')
const { Server } = require('../src/server')
const { createClient } = require('../src/createClient')
const { NethernetServerAdvertisement } = require('../src/nethernet/advertisement')
const { CURRENT_VERSION } = require('../src/options')

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

  it('discovers an unknown network ID and preserves unsupported game metadata', async () => {
    const client = discoveryClient()
    client.discoverAny = true
    const data = new NethernetServerAdvertisement({ gameVersion: '9.99.0', protocol: 9999 }).toBuffer().toString('hex')
    client.nethernet.ping = () => client.nethernet.emit('pong', { sender_id: 18446744073709551615n, data })
    const ad = await client.ping()
    assert.strictEqual(ad.networkId, 18446744073709551615n)
    assert.strictEqual(ad.gameVersion, '9.99.0')
    assert.strictEqual(ad.protocol, 9999)
    assert.strictEqual(ad.raw, data)
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

  for (const [layout, advertised, explicit, expected] of [[7, '1.21.0', undefined, '1.21.0'], [7, '9.99.0', CURRENT_VERSION, CURRENT_VERSION], [4, '1.21.0', undefined, CURRENT_VERSION]]) {
    it(`selects a game version for layout ${layout}, explicit=${explicit}`, async () => {
      const originalPing = NethernetClient.prototype.ping
      const originalInit = Client.prototype.init
      let client
      try {
        NethernetClient.prototype.ping = async () => new NethernetServerAdvertisement({ version: layout }, advertised)
        const initialized = new Promise(resolve => { Client.prototype.init = function () { resolve(this.options.version) } })
        client = createClient({ transport: 'nethernet', nethernet: { networkId: 123n }, ...(explicit ? { version: explicit } : {}), conLog: null })
        assert.strictEqual(await initialized, expected)
      } finally {
        client?.close()
        NethernetClient.prototype.ping = originalPing
        Client.prototype.init = originalInit
      }
    })
  }
})
