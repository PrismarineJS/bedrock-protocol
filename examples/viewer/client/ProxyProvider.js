const { Relay } = require('bedrock-protocol')
const { BotProvider } = require('./BotProvider')
const vec3 = require('vec3')

class ProxyProvider extends BotProvider {
  lastPlayerMovePacket

  connect () {
    const proxy = new Relay({
      hostname: '0.0.0.0',
      port: 19130,
      // logging: true,
      destination: {
        hostname: '127.0.0.1',
        port: 19132
      }
    })

    proxy.listen()

    console.info('Waiting for connect')

    const maxChunks = 40

    proxy.on('join', (client, server) => {
      client.on('clientbound', ({ name, params }) => {
        if (name == 'level_chunk') {
          // maxChunks--
          // if (maxChunks >= 0) {
          //   this.handleChunk(params)
          // }
          this.handleChunk(params, true)
        } else if (name == 'start_game') {
          this.initPhys(params.player_position, null, params.rotation.z, params.rotation.x, 0)
        } else if (name === 'play_status') {
          // this.emit('spawn', { position: server.startGameData.player_position })

          this.startPhys()
          console.info('Started physics!')
        } else if (name === 'move_player') {
          console.log('move_player', packet)
          // if (packet.runtime_id === server.entityId) {
          //   this.updatePosition(packet.position)
          //   if (this.lastServerMovement.x == packet.position.x && this.lastServerMovement.y == packet.position.y && this.lastServerMovement.z == packet.position.z) {

          //   } else {
          //     console.log('Server computed', packet.position)
          //   }
          //   this.lastServerMovement = { ...packet.position }
          // }
        }
        if (name.includes('entity') || name.includes('network_chunk_publisher_update') || name.includes('tick') || name.includes('level')) return
        console.log('CB', name)
      })

      client.on('serverbound', ({ name, params }) => {
        // { name, params }
        if (name == 'player_auth_input') {
          // console.log('player_auth_input', this.lastPlayerMovePacket, params)

          // this.controls.forward = params.input_data.up
          // this.controls.back = params.input_data.down
          // this.controls.left = params.input_data.left
          // this.controls.right = params.input_data.right
          // this.player.entity.pitch = params.pitch
          // this.player.entity.yaw = params.yaw
          this.pushInputState(params.input_data, params.yaw, params.pitch)
          this.pushCamera(params)
          this.lastMovePacket = params

          // Log Movement deltas
          {
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

const difference = (o1, o2) => Object.keys(o2).reduce((diff, key) => {
  if (o1[key] === o2[key]) return diff
  return {
    ...diff,
    [key]: o2[key]
  }
}, {})

// console.log = () => {}
// console.debug = () => {}

const diff = (o1, o2) => { const dif = difference(o1, o2); return Object.keys(dif).length ? dif : null }

module.exports = { ProxyProvider }
globalThis.logging = true
