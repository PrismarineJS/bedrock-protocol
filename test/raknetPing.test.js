/* eslint-env mocha */
const assert = require('assert')
const { spawnSync } = require('child_process')
const path = require('path')

describe('RakNet discovery backend', function () {
  this.timeout(15000)

  it('discovers a server without native RakNet', () => {
    const probe = spawnSync(process.execPath, ['-e', `
      const assert = require('assert')
      const dgram = require('dgram')
      const { once } = require('events')
      const Module = require('module')
      const load = Module._load
      let nativeAttempts = 0

      Module._load = function (name, ...args) {
        if (name === 'raknet-native') {
          nativeAttempts++
          throw new Error('Native RakNet unavailable')
        }
        return load.call(this, name, ...args)
      }

      const { ping } = require('./src/createClient')
      const { ServerAdvertisement } = require('./src/server/advertisement')
      const { NethernetClient } = require('./src/nethernet')

      async function main () {
        const socket = dgram.createSocket('udp4')
        let respond = true
        socket.bind(0, '127.0.0.1')
        await once(socket, 'listening')

        const port = socket.address().port
        const ad = new ServerAdvertisement({ motd: 'RakNet test' }, port)

        socket.on('message', (message, remote) => {
          if (!respond) return
          const pong = Buffer.alloc(33)
          pong[0] = 0x1c
          message.copy(pong, 1, 1, 9)
          pong.writeBigUInt64BE(123n, 9)
          Buffer.from('00ffff00fefefefefdfdfdfd12345678', 'hex').copy(pong, 17)
          socket.send(Buffer.concat([pong, ad.toBuffer()]), remote.port, remote.address)
        })

        const options = {
          host: '127.0.0.1',
          port,
          transport: 'raknet'
        }

        try {
          const explicit = await ping({ ...options, raknetBackend: 'jsp-raknet' })
          assert.strictEqual(explicit.motd, 'RakNet test')
          assert.strictEqual(explicit.transport, 'raknet')
          assert.strictEqual(nativeAttempts, 0)

          const legacy = await ping({ ...options, useNativeRaknet: false })
          assert.strictEqual(legacy.motd, 'RakNet test')
          assert.strictEqual(nativeAttempts, 0)

          const fallback = await ping(options)
          assert.strictEqual(fallback.motd, 'RakNet test')
          assert.strictEqual(nativeAttempts, 1)

          respond = false
          await assert.rejects(
            ping({ ...options, raknetBackend: 'jsp-raknet', timeout: 50 }),
            /Ping timed out/
          )

          const controller = new AbortController()
          const pending = assert.rejects(
            ping({ ...options, raknetBackend: 'jsp-raknet', signal: controller.signal }),
            /Cancelled/
          )
          await once(socket, 'message')
          controller.abort(new Error('Cancelled'))
          await pending

          NethernetClient.prototype.ping = async () => ({ motd: 'Nethernet test' })
          const nethernet = await ping({ transport: 'nethernet', host: '127.0.0.1' })
          assert.strictEqual(nethernet.transport, 'nethernet')
          assert.strictEqual(nativeAttempts, 1)
        } finally {
          socket.close()
        }
      }

      main().catch(error => {
        console.error(error)
        process.exitCode = 1
      })
    `], { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 10000 })

    assert.ifError(probe.error)
    assert.strictEqual(probe.status, 0, probe.stderr + probe.stdout)
  })
})
