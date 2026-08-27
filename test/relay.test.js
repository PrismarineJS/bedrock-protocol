/* eslint-env mocha */

const assert = require('assert')
const { EventEmitter } = require('events')
const { Relay } = require('../src/relay')

describe('relay connection boundary', () => {
  it('opens the upstream connection only after the downstream player joins', () => {
    let player
    class TestRelayPlayer extends EventEmitter {
      constructor () {
        super()
        player = this
      }
    }

    const relay = new Relay({
      offline: true,
      destination: { host: '127.0.0.1', port: 19132 },
      raknetBackend: 'jsp-raknet',
      relayPlayer: TestRelayPlayer
    })
    const address = { hash: 'downstream-player' }
    let upstreamConnections = 0
    relay.openUpstreamConnection = (openedPlayer, openedAddress) => {
      assert.strictEqual(openedPlayer, player)
      assert.strictEqual(openedAddress, address)
      upstreamConnections++
    }

    relay.onOpenConnection({ address })
    player.emit('login')
    assert.strictEqual(upstreamConnections, 0)

    player.emit('join')
    player.emit('join')
    assert.strictEqual(upstreamConnections, 1)
  })
})
