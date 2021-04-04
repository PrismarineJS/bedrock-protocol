/* eslint-disable */
const { Client } = require('bedrock-protocol')
const { Version } = require('bedrock-provider')
const { WorldView } = require('prismarine-viewer/viewer')
const vec3 = require('vec3')
const World = require('prismarine-world')()
const ChunkColumn = require('./Chunk')()
const { Physics, PlayerState } = require('prismarine-physics')
const { performance } = require('perf_hooks')

const PHYSICS_INTERVAL_MS = 50
const PHYSICS_TIMESTEP = PHYSICS_INTERVAL_MS / 1000

class BotProvider extends WorldView {
  chunks = {}
  lastSentPos
  positionUpdated = true

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

  close() {
    this.client?.close()
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

  handleChunk(packet, render = true) {
    const hash = (packet.x << 4) + ',' + (packet.z << 4)
    if (this.loadChunk[hash]) return
    const cc = new ChunkColumn(Version.v1_4_0, packet.x, packet.z)
    cc.networkDecodeNoCache(packet.payload, packet.sub_chunk_count).then(() => {
      this.loadedChunks[hash] = true
      this.world.setColumn(packet.x, packet.z, cc)
      const chunk = cc.serialize()
      // console.log('Chunk', chunk)
      if (render) this.emitter.emit('loadChunk', { x: packet.x << 4, z: packet.z << 4, chunk })
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
  requestPosition(time, inputState) {
    const positionUpdated = !this.lastSentPos || !this.lastPos.equals(this.lastSentPos)
    // if (globalThis.logging)console.log('New pos', this.lastSentPos,this.lastPos)

    if (positionUpdated) {
      this.lastSentPos = this.lastPos.clone()
      console.log('We computed', this.lastPos)
      this.pushCamera({
        position: this.lastSentPos,
        input_data: {},
        yaw: this.playerState.yaw, pitch: this.playerState.pitch
      }, 2)
      return
      this.client.queue('player_auth_input', {
        pitch: this.player.pitch,
        yaw: this.player.yaw,
        position: {
          x: this.lastPos.x,
          y: this.lastPos.y,
          z: this.lastPos.z
        },
        move_vector: { // Minecraft coords, N: Z+1, S: Z-1, W: X+1, E: X-1
          x: inputState.left ? 1 : (inputState.right ? -1 : 0),
          z: inputState.up ? 1 : (inputState.down ? -1 : 0)
        },
        head_yaw: this.player.headYaw,
        input_data: inputState,
        input_mode: 'mouse',
        play_mode: 'screen',
        tick: this.tick,
        delta: this.lastSentPos?.minus(this.lastPos) ?? { x: 0, y: 0, z: 0 }
      })
      this.positionUpdated = false
      this.lastSentPos = this.lastPos.clone()
    }
  }

  initPhys(position, velocity, yaw = 0, pitch = 0, headYaw = 0) {
    this.lastPos = position ? vec3(position) : vec3(0, 0, 0)
    this.lastVel = velocity ? vec3(velocity) : vec3(0, 0, 0)
    this.player = {
      version: '1.16.1',
      inventory: {
        slots: []
      },
      entity: {
        effects: {},
        position: this.lastPos,
        velocity: this.lastVel,
        onGround: false,
        isInWater: false,
        isInLava: false,
        isInWeb: false,
        isCollidedHorizontally: false,
        isCollidedVertically: false,
        yaw,
        pitch,
        headYaw // bedrock
      },
      events: { // Control events to send next tick
        startSprint: false,
        stopSprint: false,
        startSneak: false,
        stopSneak: false
      },
      jumpTicks: 0,
      jumpQueued: false,
      downJump: false
    }

    const mcData = require('minecraft-data')('1.16.1')
    this.physics = Physics(mcData, this.world)
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

  // This function should be executed each tick (every 0.05 seconds)
  // How it works: https://gafferongames.com/post/fix_your_timestep/
  timeAccumulator = 0
  lastPhysicsFrameTime = null
  inputQueue = []
  doPhysics() {
    const now = performance.now()
    const deltaSeconds = (now - this.lastPhysicsFrameTime) / 1000
    this.lastPhysicsFrameTime = now

    this.timeAccumulator += deltaSeconds

    while (this.timeAccumulator >= PHYSICS_TIMESTEP) {
      let q = this.inputQueue.shift()
      if (q) {
        Object.assign(this.playerState.control, q)
        if (q.yaw) { this.player.entity.yaw = q.yaw; this.playerState.yaw = q.yaw; }
        if (q.pitch) this.player.entity.pitch = q.pitch
      }
      this.physics.simulatePlayer(this.playerState, this.world.sync).apply(this.player)
      this.lastPos = this.playerState.pos
      this.requestPosition(PHYSICS_TIMESTEP, {
        ascend: false,
        descend: false,
        // Players bob up and down in water, north jump is true when going up.
        // In water this is only true after the player has reached max height before bobbing back down.
        north_jump: this.player.jumpTicks > 0, // Jump
        jump_down: this.controls.jump, // Jump
        sprint_down: this.controls.sprint,
        change_height: false,
        jumping: this.controls.jump, // Jump
        auto_jumping_in_water: false,
        sneaking: false,
        sneak_down: false,
        up: this.controls.forward,
        down: this.controls.back,
        left: this.controls.left,
        right: this.controls.right,
        up_left: false,
        up_right: false,
        want_up: this.controls.jump, // Jump
        want_down: false,
        want_down_slow: false,
        want_up_slow: false,
        sprinting: false,
        ascend_scaffolding: false,
        descend_scaffolding: false,
        sneak_toggle_down: false,
        persist_sneak: false,
        start_sprinting: this.player.events.startSprint || false,
        stop_sprinting: this.player.events.stopSprint || false,
        start_sneaking: this.player.events.startSneak || false,
        stop_sneaking: this.player.events.stopSneak || false,
        // Player is Update Aqatic swimming
        start_swimming: false,
        // Player stops Update Aqatic swimming
        stop_swimming: false,
        start_jumping: this.player.jumpTicks === 1, // Jump
        start_gliding: false,
        stop_gliding: false,
      })
      this.timeAccumulator -= PHYSICS_TIMESTEP
    }
  }

  startPhys() {
    console.log('Start phys')
    this.physicsLoop = setInterval(() => {
      this.doPhysics()
    }, PHYSICS_INTERVAL_MS)
  }

  setControlState(control, state) {
    if (this.controls[control] === state) return
    if (control === 'sprint') {
      this.player.events.startSprint = state
      this.player.events.stopSprint = !state
      this.controls.sprint = true
    } else if (control === 'sneak') {
      this.player.events.startSneak = state
      this.player.events.stopSneak = !state
      this.controls.sprint = true
    }
  }

  pushInputState(state, yaw, pitch) {
    const yawRad = d2r(yaw)
    const pitchRad = d2r(pitch)
    this.inputQueue.push({
      forward: state.up,
      back: state.down,// TODO: left and right switched ???
      left: state.right,
      right: state.left,
      jump: state.jump_down,
      sneak: state.sprint_down,
      yaw: yawRad, pitch: pitchRad,
    })
    globalThis.yaw = [yaw, yawRad]
    if (global.logYaw) console.log('Pushed', yaw, pitch)
  }

  pushCamera(state, id = 1) {
    let { x, y, z } = state.position
    if (id == 1) y -= 1.62 // account for player bb
    const pos = vec3({ x, y, z })
    if (state.position) {
      viewer.viewer.entities.update({
        name: 'player',
        id, pos, width: 0.6, height: 1.8,
        yaw: id == 1 ? d2r(state.yaw) : state.yaw
      })

      //viewer.viewer.camera.position.set(x, y, z)
    }

    if (state.input_data.sneak_down) {
      this.player.entity.position = pos
      this.playerState.pos = this.player.entity.position
    }
  }

  onCameraMovement(newYaw, newPitch, newHeadYaw) {
    this.player.yaw = newYaw
    this.player.pitch = newPitch
    this.player.headYaw = newHeadYaw
  }

  stopPhys() {
    clearInterval(this.physicsLoop)
  }
}
const d2r = deg => (180 - (deg < 0 ? (360 + deg) : deg)) * (Math.PI / 180)

module.exports = { BotProvider }
