const { Client } = require('bedrock-protocol')
const { BotProvider } = require('./BotProvider')

class ClientProvider extends BotProvider {
  connect () {
    const client = new Client({ hostname: '127.0.0.1', version: '1.16.210', port: 19132, connectTimeout: 100000 })

    client.once('resource_packs_info', (packet) => {
      client.write('resource_pack_client_response', {
        response_status: 'completed',
        resourcepackids: []
      })

      client.once('resource_pack_stack', (stack) => {
        client.write('resource_pack_client_response', {
          response_status: 'completed',
          resourcepackids: []
        })
      })

      client.queue('client_cache_status', { enabled: false })
      client.queue('request_chunk_radius', { chunk_radius: 1 })
      client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: 0n })
    })

    this.client = client
  }

  close () {
    this.client?.close()
  }

  listenToBot () {
    this.client.on('connect', () => {
      console.log('Bot has connected!')
    })
    this.client.on('start_game', packet => {
      this.updatePosition(packet.player_position)
    })

    this.client.on('spawn', () => {
      // server allows client to render chunks & spawn in world
      this.emit('spawn', { position: this.lastPos })

      this.tickLoop = setInterval(() => {
        this.client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: 0n })
      })
    })

    this.client.on('level_chunk', packet => {
      this.handleChunk(packet)
    })

    this.client.on('move_player', packet => {
      if (packet.runtime_id === this.client.entityId) this.updatePosition(packet.position)
    })

    this.client.on('set_entity_motion', packet => {
      if (packet.runtime_id === this.client.entityId) this.updatePosition(packet.position)
    })

    this.client.on('tick_sync', (packet) => {
      this.lastTick = packet.response_time
    })
  }
}

module.exports = { ClientProvider }
