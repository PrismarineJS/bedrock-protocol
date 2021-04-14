const { Version } = require('bedrock-provider')
const { WorldView } = require('prismarine-viewer/viewer')
const World = require('prismarine-world')()
const ChunkColumn = require('./Chunk')()
const { MovementManager } = require('./movements')

class BotProvider extends WorldView {
  chunks = {}
  lastSentPos
  positionUpdated = true

  constructor () {
    super()
    this.connect()
    this.listenToBot()
    this.world = new World()
    this.movements = new MovementManager(this)

    this.onKeyDown = () => {}
    this.onKeyUp = () => {}

    this.removeAllListeners('mouseClick')
  }

  raycast () {
    // TODO : fix
  }

  get entity () { return this.movements.player.entity }

  handleChunk (packet, render = true) {
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

  updatePlayerCamera (id, position, yaw, pitch, updateState) {
    this.emit('playerMove', id, { position, yaw, pitch })

    if (updateState) {
      this.movements.updatePosition(position, yaw, pitch)
    }
  }

  stopBot () {
    clearInterval(this.tickLoop)
    this.movements.stopPhys()
  }
}

module.exports = { BotProvider }
