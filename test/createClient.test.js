/* eslint-env mocha */

const assert = require('assert')
const { Client } = require('../src/client')
const { createClient } = require('../src/createClient')

describe('createClient', () => {
  it('requests the legacy initial chunk radius synchronously for 1.16.201', () => {
    const originalConnect = Client.prototype.connect
    const originalQueue = Client.prototype.queue
    const originalWrite = Client.prototype.write
    const queued = []

    Client.prototype.connect = function () {}
    Client.prototype.queue = function (name, params) { queued.push({ name, params }) }
    Client.prototype.write = function () {}

    try {
      const client = createClient({
        host: '127.0.0.1',
        port: 19132,
        username: 'LegacyClient',
        version: '1.16.201',
        offline: true,
        skipPing: true
      })

      client.emit('resource_packs_info', {})
      assert.deepStrictEqual(
        queued.find(packet => packet.name === 'request_chunk_radius'),
        { name: 'request_chunk_radius', params: { chunk_radius: 1 } }
      )
      client.emit('spawn')
      assert.deepStrictEqual(
        queued.filter(packet => packet.name === 'request_chunk_radius').at(-1),
        { name: 'request_chunk_radius', params: { chunk_radius: 10 } }
      )
      client.emit('close')
    } finally {
      Client.prototype.connect = originalConnect
      Client.prototype.queue = originalQueue
      Client.prototype.write = originalWrite
    }
  })
})
