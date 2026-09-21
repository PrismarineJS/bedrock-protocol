/* eslint-env mocha */
const assert = require('assert')
const { Server } = require('../src/server')
const { createClient, ping } = require('../src/createClient')
const { CURRENT_VERSION } = require('../src/options')
const { SignalStructure, SignalType } = require('nethernet')

// Exercise discovery, WebRTC, headerless batching, and the Minecraft handshake
// together. Both peers stay on loopback and authenticate offline.
describe('Nethernet LAN transport', function () {
  this.timeout(20000)
  for (const initiator of ['client', 'server']) {
    it(`discovers, logs in and closes once from the ${initiator}`, async () => {
      const networkId = 123456789n
      const server = new Server({ transport: 'nethernet', nethernet: { networkId }, host: '127.0.0.1', offline: true, version: CURRENT_VERSION })
      let client
      let serverPlayer
      let timer
      try {
        await server.listen()
        assert.strictEqual(server.transport.nethernet.socket.address().address, '127.0.0.1')
        server.transport.updateAdvertisement()
        const ad = await ping({ host: '127.0.0.1', nethernet: { networkId } })
        assert.strictEqual(ad.gameVersion, CURRENT_VERSION)
        const joined = new Promise((resolve, reject) => {
          let joins = 0
          const onJoin = () => { if (++joins === 2) resolve() }
          timer = setTimeout(() => reject(new Error('Nethernet login timed out')), 12000)
          server.on('error', reject)
          server.on('connect', player => {
            serverPlayer = player
            player.on('error', reject)
            player.once('join', onJoin)
          })
          client = createClient({
            transport: 'nethernet',
            nethernet: { networkId },
            host: '127.0.0.1',
            offline: true,
            username: 'NethernetTest',
            version: CURRENT_VERSION,
            skipPing: true,
            conLog: null
          })
          client.on('error', reject)
          client.once('join', onJoin)
        })
        await joined
        assert.strictEqual(server.clientCount, 1)
        clearTimeout(timer)
        let closes = 0
        serverPlayer.on('close', () => { closes++; serverPlayer.close() })
        await new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Nethernet disconnect timed out')), 5000)
          serverPlayer.once('close', resolve)
          if (initiator === 'client') client.disconnect()
          else serverPlayer.close()
        })
        assert.strictEqual(closes, 1)
        assert.strictEqual(server.clientCount, 0)
        assert.deepStrictEqual(Object.keys(server.clients), [])
      } finally {
        clearTimeout(timer)
        client?.close()
        await server.close()
      }
    })
  }

  it('does not count negotiation failure as a departing player', async () => {
    const server = new Server({ transport: 'nethernet', host: '127.0.0.1', offline: true })
    let connected = 0
    server.on('connect', () => { connected++ })
    try {
      await server.listen()
      const replies = []
      await server.transport.nethernet.handleOffer(new SignalStructure(SignalType.ConnectRequest, 888n, 'not-valid-sdp', 999n), signal => replies.push(signal))
      assert(replies.some(signal => signal.type === SignalType.ConnectError))
      assert.strictEqual(connected, 0)
      assert.strictEqual(server.clientCount, 0)
      assert.deepStrictEqual(Object.keys(server.clients), [])
      assert.strictEqual(server.getAdvertisement().playerCount, 0)
    } finally {
      await server.close()
    }
  })

  it('rejects a second client at capacity and admits a replacement after close', async () => {
    const networkId = 777n
    const server = new Server({ transport: 'nethernet', nethernet: { networkId }, host: '127.0.0.1', offline: true, maxPlayers: 1 })
    const clients = []
    const timers = []
    let connections = 0
    server.on('connect', player => {
      connections++
      player.on('error', error => { throw error })
    })
    function join () {
      const client = createClient({ transport: 'nethernet', nethernet: { networkId }, host: '127.0.0.1', offline: true, username: 'Capacity' + clients.length, skipPing: true, conLog: null })
      clients.push(client)
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Client neither joined nor closed')), 12000)
        timers.push(timer)
        client.once('error', reject)
        client.once('join', () => { clearTimeout(timer); resolve('joined') })
        client.once('close', () => { clearTimeout(timer); resolve('closed') })
      })
    }
    try {
      await server.listen()
      assert.strictEqual(await join(), 'joined')
      assert.strictEqual(await join(), 'closed')
      assert.strictEqual(server.clientCount, 1)
      assert.strictEqual(Object.keys(server.clients).length, 1)
      assert.strictEqual(connections, 1)
      assert.strictEqual(server.getAdvertisement().playersMax, 1)
      Object.values(server.clients)[0].close()
      assert.strictEqual(server.clientCount, 0)
      assert.strictEqual(await join(), 'joined')
      assert.strictEqual(connections, 2)
      assert.strictEqual(server.clientCount, 1)
    } finally {
      timers.forEach(clearTimeout)
      clients.forEach(client => client.close())
      await server.close()
    }
  })
})
