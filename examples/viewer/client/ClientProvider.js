const { Client } = require('bedrock-protocol')
const { BotProvider } = require('./BotProvider')

const controlMap = {
  forward: ['KeyW', 'KeyZ'],
  back: 'KeyS',
  left: ['KeyA', 'KeyQ'],
  right: 'KeyD',
  sneak: 'ShiftLeft',
  jump: 'Space'
}

class ClientProvider extends BotProvider {
  downKeys = new Set()

  connect () {
    const client = new Client({ host: '127.0.0.1', version: '1.16.210', username: 'notch', offline: true, port: 19132, connectTimeout: 100000 })

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

      this.heartbeat = setInterval(() => {
        client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: 0n })
      })
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
      this.movements.init('server', packet.player_position, /* vel */ null, packet.rotation.z || 0, packet.rotation.x || 0, 0)
    })

    this.client.on('spawn', () => {
      this.movements.startPhys()
      // server allows client to render chunks & spawn in world
      this.emit('spawn', { position: this.lastPos, firstPerson: true })

      this.tickLoop = setInterval(() => {
        this.client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: 0n })
      })
    })

    this.client.on('level_chunk', packet => {
      this.handleChunk(packet)
    })

    this.client.on('move_player', packet => {
      if (packet.runtime_id === this.client.entityId) {
        this.movements.updatePosition(packet.position, packet.yaw, packet.pitch, packet.head_yaw, packet.tick)
      }
    })

    this.client.on('set_entity_motion', packet => {
      // if (packet.runtime_id === this.client.entityId) this.updatePosition(packet.position)
    })

    this.client.on('tick_sync', (packet) => {
      this.lastTick = packet.response_time
    })
  }

  onKeyDown = (evt) => {
    const code = evt.code
    for (const control in controlMap) {
      if (controlMap[control].includes(code)) {
        this.movements.setControlState(control, true)
        break
      }
      if (evt.ctrlKey) {
        this.movements.setControlState('sprint', true)
      }
    }
    this.downKeys.add(code)
  }

  onKeyUp = (evt) => {
    const code = evt.code
    if (code === 'ControlLeft' && this.downKeys.has('ControlLeft')) {
      this.movements.setControlState('sprint', false)
    }
    for (const control in controlMap) {
      if (controlMap[control].includes(code)) {
        this.movements.setControlState(control, false)
        break
      }
    }
    this.downKeys.delete(code)
  }
}

module.exports = { ClientProvider }
