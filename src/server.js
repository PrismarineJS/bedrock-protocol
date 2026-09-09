const { EventEmitter } = require('events')
const { createDeserializer, createSerializer } = require('./transforms/serializer')
const { Player } = require('./serverPlayer')
const { ServerAdvertisement, NethernetServerAdvertisement } = require('./server/advertisement')
const { MessageID } = require('./raknet/constants')

const RAKNET_CLOSE_REASON = {
  [MessageID.ID_DISCONNECTION_NOTIFICATION]: 'DISCONNECTION_NOTIFICATION (peer left cleanly)',
  [MessageID.ID_CONNECTION_LOST]: 'CONNECTION_LOST (peer timed out — relay event loop blocked or network issue)',
  [MessageID.ID_INCOMPATIBLE_PROTOCOL_VERSION]: 'INCOMPATIBLE_PROTOCOL_VERSION (RakNet protocol mismatch)'
}

const debug = globalThis.isElectron ? console.log : require('debug')('minecraft-protocol')

class Server extends EventEmitter {
  constructor(options) {
    super()

    this.options = { ...options }

    switch (this.options.transport) {
      default:
      case "DEFAULT":
        this.transportServer = require('./rak').RakServer
        this.advertisement = new ServerAdvertisement(this.options.motd, this.options.port, this.options.version)
        this.batchHeader = 0xfe
        this.disableEncryption = false
        break;
      case "NETHERNET":
        this.transportServer = require('./nethernet').NethernetServer
        this.advertisement = new NethernetServerAdvertisement(this.options.motd, this.options.version)
        this.batchHeader = null
        this.disableEncryption = true
        this.nethernet = {}
        break;
    }

    this.features = { compressorInHeader: true }
    this.serializer = createSerializer()
    this.deserializer = createDeserializer()
    this.advertisement.playersMax = options.maxPlayers ?? 3
    /** @type {Object<string, Player>} */
    this.clients = {}
    this.clientCount = 0
    this.conLog = debug

    this.setCompressor(this.options.compressionAlgorithm, this.options.compressionLevel, this.options.compressionThreshold)
  }

  setCompressor(algorithm, level = 1, threshold = 256) {
    switch (algorithm) {
      case 'none':
        this.compressionAlgorithm = 'none'
        this.compressionLevel = 0
        this.compressionHeader = 255
        break
      case 'deflate':
        this.compressionAlgorithm = 'deflate'
        this.compressionLevel = level
        this.compressionThreshold = threshold
        this.compressionHeader = 0
        break
      case 'snappy':
        this.compressionAlgorithm = 'snappy'
        this.compressionLevel = level
        this.compressionThreshold = threshold
        this.compressionHeader = 1
        break
      default:
        this.compressionAlgorithm = 'deflate'
        this.compressionLevel = 7
        this.compressionThreshold = 512
        this.compressionHeader = 0
        break;
    }
  }

  onOpenConnection = (conn) => {
    const player = new Player(this, conn)
    this.clients[conn.address] = player
    this.clientCount++
    this.emit('connect', player)
  }

  onCloseConnection = (conn, reason) => {
    console.log('RakNet closeConnection from', conn.address, '— reason:', RAKNET_CLOSE_REASON[reason] || `unknown id ${reason}`)
    this.clients[conn.address]?.close()
    delete this.clients[conn.address]
    this.clientCount--
  }

  onEncapsulated = (buffer, address) => {
    const client = this.clients[address]
    if (!client) return
    process.nextTick(() => client.handle(buffer))
  }

  getAdvertisement() {
    if (this.options.advertisementFn) return this.options.advertisementFn()
    this.advertisement.playersOnline = this.clientCount
    return this.advertisement
  }

  async listen() {
    const { host, port, networkId, maxPlayers } = this.options
    this.transport = new this.transportServer({ host, port, networkId, maxPlayers }, this)

    try {
      await this.transport.listen()
    } catch (e) {
      console.warn(`Failed to bind server on [${this.options.host}]/${this.options.port}, is the port free?`)
      throw e
    }

    console.log('Listening on', host, port, this.options.version)
    this.transport.onOpenConnection = this.onOpenConnection
    this.transport.onCloseConnection = this.onCloseConnection
    this.transport.onEncapsulated = this.onEncapsulated
    this.transport.onClose = (reason) => this.close(reason || 'Transport closed')

    this.serverTimer = setInterval(() => {
      this.transport.updateAdvertisement()
    }, 1000)

    return { host, port }
  }

  async close(disconnectReason = 'Server closed') {
    this.emit('close', disconnectReason)

    for (const caddr in this.clients) {
      const client = this.clients[caddr]
      client.disconnect(disconnectReason)
    }

    clearInterval(this.serverTimer)
    this.clients = {}
    this.clientCount = 0

    this.transport.close()
  }
}

module.exports = { Server }