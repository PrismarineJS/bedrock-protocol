/* eslint-disable */
const { Client } = require('bedrock-protocol')
const { Version } = require('bedrock-provider')
const { WorldView } = require('prismarine-viewer/viewer')
const vec3, { Vec3 } = require('vec3')
const World = require('prismarine-world')()
const ChunkColumn = require('./Chunk')()
const Physics = require('prismarine-physics')

class BotProvider extends WorldView {
  chunks = {}
  lastSentPos

  constructor() {
    super()
    this.connect()
    this.listenToBot()
    this.world = new World()

    // Server auth movement : we send inputs, server calculates position & sends back
    this.serverMovements = true

    this.tick = 0n
  }

  connect() {
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

  listenToBot() {
    this.client.on('connect', () => {
      console.log('Bot has connected!')
    })
    this.client.on('start_game', packet => {
      this.updatePosition(packet.player_position)
    })

    this.client.on('spawn', () => {
      // server allows client to render chunks & spawn in world
      this.emit('spawn', { position: this.lastPos })
    })

    this.client.on('level_chunk', packet => {
      const cc = new ChunkColumn(Version.v1_4_0, packet.x, packet.z)
      cc.networkDecodeNoCache(packet.payload, packet.sub_chunk_count).then(() => {
        this.loadedChunks[(packet.x << 4) + ',' + (packet.z << 4)] = true
        this.world.setColumn(packet.x, packet.z, cc)
        const chunk = cc.serialize()
        console.log('Chunk', chunk)
        this.emitter.emit('loadChunk', { x: packet.x << 4, z: packet.z << 4, chunk })
      })
    })

    this.client.on('move_player', packet => {
      if (packet.runtime_id === this.client.entityId) this.updatePosition(packet.position)
    })

    this.client.on('set_entity_motion', packet=>{ 
      if (packet.runtime_id === this.client.entityId) this.updatePosition(packet.position)
    })

    this.client.on('tick_sync', (packet) => {
      this.lastTick = packet.request_time
    })

    this.tickLoop = setInterval(() => {
      client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: 0n })
    })
  }

  stopBot() {
    clearInterval(this.tickLoop)
  }

  // Server gives us a new position
  updatePosition(pos) {
    this.lastPos ??= vec3(pos)
    super.updatePosition(this.lastPos)
  }

  // Ask the server to be in a new position
  requestPosition() {
    const positionUpdated = !this.lastSentPos || !this.lastPos.equals(this.lastSentPos)

    if (positionUpdated) {
      this.client.queue('player_auth_input', {
        pitch: 0,
        yaw: this.lastYaw,
        position: {
          x: this.lastPos.x,
          y: this.lastPos.y,
          z: this.lastPos.z
        },
        move_vector: { x: 0, z: 0 },
        head_yaw: 0,
        input_data: {
          ascend: false,
          descend: false,
          north_jump: false,
          jump_down: false,
          sprint_down: false,
          change_height: false,
          jumping: false,
          auto_jumping_in_water: false,
          sneaking: false,
          sneak_down: false,
          up: false,
          down: false,
          left: false,
          right: false,
          up_left: false,
          up_right: false,
          want_up: false,
          want_down: false,
          want_down_slow: false,
          want_up_slow: false,
          sprinting: false,
          ascend_scaffolding: false,
          descend_scaffolding: false,
          sneak_toggle_down: false,
          persist_sneak: false
        },
        input_mode: 'mouse',
        play_mode: 'screen',
        tick: this.tick,
        delta: { x: 0, y: -0.07840000092983246, z: 0 }
      })
    }
  }

  initPhys() {
    this.lastVel = new Vec3(0, 0, 0)
    this.lastYaw = 0
    this.player = {
      entity: {
        position: this.lastPos,
        velocity: this.lastVel,
        onGround: false,
        isInWater: false,
        isInLava: false,
        isInWeb: false,
        isCollidedHorizontally: false,
        isCollidedVertically: false,
        yaw: this.lastYaw
      },
      jumpTicks: 0,
      jumpQueued: false
    }

    this.physics = Physics(mcData, fakeWorld)
    this.controls = {
      forward: false,
      back: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      sneak: false
    }
    this.playerState = new PlayerState(this.player, this.controls)
  }

  startPhys() {
    this.physicsLoop = setInterval(() => {
      this.physics.simulatePlayer(this.playerState, this.world).apply(this.player)
      this.requestPosition()
    }, 50)
  }

  stopPhys() {
    clearInterval(this.physics)
  }
}

module.exports = { BotProvider }
