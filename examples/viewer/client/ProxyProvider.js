const { Relay } = require('bedrock-protocol')
const { BotProvider } = require('./BotProvider')
const { diff } = require('./util')

class ProxyProvider extends BotProvider {
  lastPlayerMovePacket

  connect () {
    const proxy = new Relay({
      host: '0.0.0.0',
      port: 19130,
      // logging: true,
      destination: {
        host: '127.0.0.1',
        port: 19132
      }
    })
    proxy.listen()
    console.info('Waiting for connect')

    proxy.on('join', (client, server) => {
      client.on('clientbound', ({ name, params }) => {
        if (name === 'level_chunk') {
          this.handleChunk(params, true)
        } else if (name === 'start_game') {
          this.movements.init('', params.player_position, null, params.rotation.z, params.rotation.x, 0)
        } else if (name === 'play_status') {
          this.movements.startPhys()
          this.emit('spawn', { position: this.movements.lastPos, firstPerson: true })
          console.info('Started physics!')
        } else if (name === 'move_player') {
          console.log('move_player', params)
          this.movements.updatePosition(params.position, params.yaw, params.pitch, params.head_yaw, params.tick)
        }

        if (name.includes('entity') || name.includes('network_chunk_publisher_update') || name.includes('tick') || name.includes('level')) return
        console.log('CB', name)
      })

      client.on('serverbound', ({ name, params }) => {
        // { name, params }
        if (name === 'player_auth_input') {
          this.movements.pushInputState(params.input_data, params.yaw, params.pitch)
          this.movements.pushCameraControl(params, 1)

          // Log Movement deltas
          {
            this.lastMovePacket = params
            if (this.firstPlayerMovePacket) {
              const id = diff(this.firstPlayerMovePacket.input_data, params.input_data)
              const md = diff(this.firstPlayerMovePacket.move_vector, params.move_vector)
              const dd = diff(this.firstPlayerMovePacket.delta, params.delta)
              if (id || md) {
                if (globalThis.logging) console.log('Move', params.position, id, md, dd)
                globalThis.movements ??= []
                globalThis.movements.push(params)
              }
            }
            if (!this.firstPlayerMovePacket) {
              this.firstPlayerMovePacket = params
              for (const key in params.input_data) {
                params.input_data[key] = false
              }
              params.input_data._value = 0n
              params.move_vector = { x: 0, z: 0 }
              params.delta = { x: 0, y: 0, z: 0 }
            }
          }
        } else if (!name.includes('tick') && !name.includes('level')) {
          console.log('Sending', name)
        }
      })
      console.info('Client and Server Connected!')
    })

    this.proxy = proxy
  }

  listenToBot () {

  }

  close () {
    this.proxy?.close()
  }
}

module.exports = { ProxyProvider }
globalThis.logging = true
