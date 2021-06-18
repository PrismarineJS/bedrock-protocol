const { EventEmitter } = require('events')
const { createDeserializer, createSerializer } = require('./transforms/serializer')
const { Player } = require('./serverPlayer')
const { RakServer } = require('./rak')
const { sleep } = require('./datatypes/util')
const { ServerAdvertisement } = require('./server/advertisement')
const Options = require('./options')
const debug = globalThis.isElectron ? console.debug : require('debug')('minecraft-protocol')

class Server extends EventEmitter {
  constructor (options) {
    super()
    this.options = { ...Options.defaultOptions, ...options }
    this.validateOptions()
    this.serializer = createSerializer(this.options.version)
    this.deserializer = createDeserializer(this.options.version)
    this.advertisement = new ServerAdvertisement(this.options.motd)
    this.advertisement.playersMax = options.maxPlayers ?? 3
    /** @type {Object<string, Player>} */
    this.clients = {}
    this.clientCount = 0
    this.conLog = debug
  }

  validateOptions () {
    if (!Options.Versions[this.options.version]) {
      console.warn('Supported versions', Options.Versions)
      throw Error(`Unsupported version ${this.options.version}`)
    }
    this.options.protocolVersion = Options.Versions[this.options.version]
    if (this.options.protocolVersion < Options.MIN_VERSION) {
      throw new Error(`Protocol version < ${Options.MIN_VERSION} : ${this.options.protocolVersion}, too old`)
    }
  }

  onOpenConnection = (conn) => {
    this.conLog('new connection', conn?.address)
    const player = new Player(this, conn)
    this.clients[conn.address] = player
    this.clientCount++
    this.emit('connect', player)
  }

  onCloseConnection = (inetAddr, reason) => {
    this.conLog('close connection', inetAddr?.address, reason)
    delete this.clients[inetAddr]?.connection // Prevent close loop
    this.clients[inetAddr?.address ?? inetAddr]?.close()
    delete this.clients[inetAddr]
    this.clientCount--
  }

  onEncapsulated = (buffer, address) => {
    const client = this.clients[address]
    if (!client) {
      throw new Error(`packet from unknown inet addr: ${address}`)
    }
    client.handle(buffer)
  }

  getAdvertisement () {
    if (this.options.advertisementFn) {
      return this.options.advertisementFn()
    }
    this.advertisement.playersOnline = this.clientCount
    return this.advertisement
  }

  async listen (host = this.options.host, port = this.options.port) {
    this.raknet = new RakServer({ host, port }, this)
    try {
      await this.raknet.listen()
    } catch (e) {
      console.warn(`Failed to bind server on [${this.options.host}]/${this.options.port}, is the port free?`)
      throw e
    }
    this.conLog('Listening on', host, port, this.options.version)
    this.raknet.onOpenConnection = this.onOpenConnection
    this.raknet.onCloseConnection = this.onCloseConnection
    this.raknet.onEncapsulated = this.onEncapsulated

    this.serverTimer = setInterval(() => {
      this.raknet.updateAdvertisement()
    }, 1000)

    return { host, port }
  }

  async close (disconnectReason) {
    for (const caddr in this.clients) {
      const client = this.clients[caddr]
      client.disconnect(disconnectReason)
    }

    clearInterval(this.serverTimer)
    this.clients = {}
    this.clientCount = 0

    // Allow some time for client to get disconnect before closing connection.
    await sleep(60)
    this.raknet.close()
  }
}

module.exports = { Server }
