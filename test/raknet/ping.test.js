/* eslint-env mocha */

const assert = require('assert')
const dgram = require('dgram')
const { ping } = require('../..')

const OFFLINE_MESSAGE_MAGIC = Buffer.from('00ffff00fefefefefdfdfdfd12345678', 'hex')

describe('RakNet ping', function () {
  it('accepts an unconnected pong without an advertisement', async () => {
    const socket = dgram.createSocket('udp4')

    await new Promise((resolve, reject) => {
      socket.once('error', reject)
      socket.bind(0, '127.0.0.1', () => {
        socket.removeListener('error', reject)
        resolve()
      })
    })

    socket.once('message', (request, remote) => {
      const pong = Buffer.alloc(33)
      pong[0] = 0x1c
      request.copy(pong, 1, 1, 9)
      pong.writeBigUInt64BE(1n, 9)
      OFFLINE_MESSAGE_MAGIC.copy(pong, 17)
      socket.send(pong, remote.port, remote.address)
    })

    try {
      const result = await ping({ host: '127.0.0.1', port: socket.address().port })
      assert.strictEqual(result.header, '')
    } finally {
      await new Promise(resolve => socket.close(resolve))
    }
  })
})
