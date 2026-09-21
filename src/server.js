const { EventEmitter } = require('events')
const { createDeserializer, createSerializer } = require('./transforms/serializer')
const { Player } = require('./serverPlayer')
const { sleep } = require('./datatypes/util')
const { ServerAdvertisement, NethernetServerAdvertisement } = require('./server/advertisement')
const Options = require('./options')
const { closeNethernet } = require('./nethernet/cleanup')

const debug = globalThis.isElectron ? console.debug : require('debug')('minecraft-protocol')

class Server extends EventEmitter {
  constructor (options) {
    super()
    this._closed = false

    this.options = { ...Options.defaultOptions, ...options, nethernet: { signalling: 'lan', ...options.nethernet } }
    this.options.maxPlayers ??= 3
    this.validateOptions()

    if (this.options.transport === 'nethernet') {
      this.transportServer = require('./nethernet').NethernetServer
      this.advertisement = new NethernetServerAdvertisement(this.options.motd, this.options.version)
      // Online credentials remain valid in offline mode; self-signed logins
      // are only accepted when verification is disabled.
      this.advertisement.acceptsOnlineAuth = true
      this.advertisement.acceptsSelfSignedAuth = this.options.offline === true
      this.batchHeader = null
      this.disableEncryption = true
      this.nethernet = {}
    } else if (this.options.transport === 'raknet') {
      this.transportServer = require('./rak')(this.options.raknetBackend).RakServer
      this.advertisement = new ServerAdvertisement(this.options.motd, this.options.port, this.options.version)
      this.batchHeader = 0xfe
      this.disableEncryption = false
    } else {
      throw new Error(`Unsupported transport: ${this.options.transport} (nethernet, raknet)`)
    }

    this._loadFeatures(this.options.version)
    this.serializer = createSerializer(this.options.version)
    this.deserializer = createDeserializer(this.options.version)
    this.advertisement.playersMax = this.options.maxPlayers
    /** @type {Object<string, Player>} */
    this.clients = {}
    this.clientCount = 0
    this.conLog = debug

    this.setCompressor(this.options.compressionAlgorithm, this.options.compressionLevel, this.options.compressionThreshold)
  }

  _loadFeatures (version) {
    try {
      const mcData = require('minecraft-data')('bedrock_' + version)
      this.features = {
        compressorInHeader: mcData.supportFeature('compressorInPacketHeader'),
        newLoginIdentityFields: mcData.supportFeature('newLoginIdentityFields')
      }
    } catch (e) {
      throw new Error(`Unsupported version: '${version}', no data available`)
    }
  }

  setCompressor (algorithm, level = 1, threshold = 256) {
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
        throw new Error(`Unknown compression algorithm: ${algorithm}`)
    }
  }

  validateOptions () {
    Options.validateOptions(this.options)
  }

  versionLessThan (version) {
    return this.options.protocolVersion < (typeof version === 'string' ? Options.Versions[version] : version)
  }

  versionGreaterThan (version) {
    return this.options.protocolVersion > (typeof version === 'string' ? Options.Versions[version] : version)
  }

  versionGreaterThanOrEqualTo (version) {
    return this.options.protocolVersion >= (typeof version === 'string' ? Options.Versions[version] : version)
  }

  onOpenConnection = (conn) => {
    if (this.clients[conn.address]) return
    if (this._closed || this.clientCount >= this.options.maxPlayers) {
      conn.close()
      return
    }
    this.conLog('New connection: ', conn?.address)

    const player = new Player(this, conn)
    this.clients[conn.address] = player
    this.clientCount++
    this.emit('connect', player)
  }

  onCloseConnection = (conn, reason) => {
    this.conLog('Connection closed: ', conn.address, reason)
    const player = this.clients[conn.address]
    if (!player) return
    delete this.clients[conn.address]
    this.clientCount--
    player.close(reason)
  }

  onEncapsulated = (buffer, address) => {
    const client = this.clients[address]
    if (!client) {
      // Ignore packets from clients that are not connected.
      debug(`Ignoring packet from unknown inet address: ${address}`)
      return
    }

    process.nextTick(() => client.handle(buffer))
  }

  getAdvertisement () {
    if (this.options.advertisementFn) {
      return this.options.advertisementFn()
    }

    this.advertisement.playersOnline = this.clientCount
    return this.advertisement
  }

  async listen () {
    if (this._closed) return
    const { host, port, maxPlayers } = this.options
    // eslint-disable-next-line new-cap
    this.transport = new this.transportServer({ host, port, ...this.options.nethernet, maxPlayers }, this)

    this.transport.onError = error => this.onConnectionError(error)

    try {
      this._listenPromise = Promise.resolve(this.transport.listen())
      await this._listenPromise
    } catch (e) {
      console.warn(`Failed to bind server on [${this.options.host}]/${this.options.port}, is the port free?`)
      throw e
    }

    if (this._closed) return

    this.conLog('Listening on', host, port, this.options.version)
    this.transport.onOpenConnection = this.onOpenConnection
    this.transport.onCloseConnection = this.onCloseConnection
    this.transport.onEncapsulated = this.onEncapsulated
    this.transport.onClose = (reason) => this.close(reason || 'Transport closed')

    this.serverTimer = setInterval(() => {
      this.transport.updateAdvertisement()
    }, 1000)

    return { host, port }
  }

  onConnectionError (error) {
    if (this._closed) return
    try {
      this.emit('error', error)
    } finally {
      this.close().catch(error => debug('Server cleanup failed', error))
    }
  }

  close (disconnectReason = 'Server closed') {
    if (this._closePromise) return this._closePromise
    this._closed = true
    this._closePromise = Promise.resolve().then(() => this._close(disconnectReason))
    return this._closePromise
  }

  async _close (disconnectReason) {
    const cleanup = closeNethernet(this.nethernet)
    clearInterval(this.serverTimer)
    try {
      this.emit('close', disconnectReason)
      for (const client of Object.values(this.clients)) client.disconnect(disconnectReason)
    } finally {
      this.clients = {}
      this.clientCount = 0
      // Allow the disconnect packets to reach clients before closing transport.
      await sleep(60)
      await this._listenPromise?.catch(() => {})
      try {
        this.transport?.close()
      } finally {
        await cleanup
      }
    }
  }
}

module.exports = { Server }
