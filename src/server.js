const { EventEmitter } = require('events')
const { createDeserializer, createSerializer } = require('./transforms/serializer')
const { Player } = require('./serverPlayer')
const { RakServer } = require('./rak')
const Options = require('./options')
const debug = require('debug')('minecraft-protocol')

class Server extends EventEmitter {
  constructor (options) {
    super()
    this.options = { ...Options.defaultOptions, ...options }
    this.validateOptions()
    this.serializer = createSerializer(this.options.version)
    this.deserializer = createDeserializer(this.options.version)
    /** @type {Object<string, Player>} */
    this.clients = {}
    this.clientCount = 0
    this.inLog = (...args) => debug('C -> S', ...args)
    this.outLog = (...args) => debug('S -> C', ...args)
  }

  validateOptions () {
    if (!Options.Versions[this.options.version]) {
      console.warn('Supported versions: ', Options.Versions)
      throw Error(`Unsupported version ${this.options.version}`)
    }
    this.options.protocolVersion = Options.Versions[this.options.version]
    if (this.options.protocolVersion < Options.MIN_VERSION) {
      throw new Error(`Protocol version < ${Options.MIN_VERSION} : ${this.options.protocolVersion}, too old`)
    }
  }

  onOpenConnection = (conn) => {
    this.inLog('new connection', conn)
    const player = new Player(this, conn)
    this.clients[conn.address] = player
    this.clientCount++
    this.emit('connect', player)
  }

  onCloseConnection = (inetAddr, reason) => {
    console.debug('close connection', inetAddr, reason)
    delete this.clients[inetAddr]
    this.clientCount--
  }

  onEncapsulated = (buffer, address) => {
    // this.inLog('encapsulated', address, buffer)
    const client = this.clients[address]
    if (!client) {
      throw new Error(`packet from unknown inet addr: ${address}`)
    }
    client.handle(buffer)
  }

  async listen (hostname = this.options.hostname, port = this.options.port) {
    this.raknet = new RakServer({ hostname, port })
    await this.raknet.listen()
    console.debug('Listening on', hostname, port)
    this.raknet.onOpenConnection = this.onOpenConnection
    this.raknet.onCloseConnection = this.onCloseConnection
    this.raknet.onEncapsulated = this.onEncapsulated
  }

  close (disconnectReason) {
    for (const caddr in this.clients) {
      const client = this.clients[caddr]
      client.disconnect(disconnectReason)
    }
    this.raknet.close()
    this.clients = {}
    this.clientCount = 0
  }
}

module.exports = { Server }
