/* eslint-env mocha */
const assert = require('assert')
const { Server } = require('../src/server')
const { createClient, ping } = require('../src/createClient')
const { CURRENT_VERSION } = require('../src/options')

// Exercise discovery, WebRTC, headerless batching, and the Minecraft handshake
// together. Both peers stay on loopback and authenticate offline.
describe('Nethernet LAN transport', function () {
  this.timeout(20000)
  it('discovers a server and completes both sides of the login handshake', async () => {
    const networkId = 123456789n
    const server = new Server({ transport: 'nethernet', networkId, host: '127.0.0.1', offline: true, version: CURRENT_VERSION })
    let client
    let serverPlayer
    let timer
    try {
      await server.listen()
      server.transport.updateAdvertisement()
      const ad = await ping({ host: '127.0.0.1', networkId })
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
          networkId,
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
      await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Nethernet disconnect timed out')), 5000)
        serverPlayer.once('close', resolve)
        client.disconnect()
      })
      assert.strictEqual(server.clientCount, 0)
      assert.deepStrictEqual(Object.keys(server.clients), [])
    } finally {
      clearTimeout(timer)
      client?.close()
      await server.close()
    }
  })
})
