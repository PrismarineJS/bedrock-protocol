const { EventEmitter } = require('events')
const { createDeserializer, createSerializer } = require('./transforms/serializer')
const { Player } = require('./serverPlayer')
const { RakServer } = require('./rak')
const Options = require('./options')
const debug = require('debug')('minecraft-protocol')

class Server extends EventEmitter {
  constructor(options) {
    super()
    this.options = { ...Options.defaultOptions, ...options }
    this.serializer = createSerializer()
    this.deserializer = createDeserializer()
    this.clients = {}
    this.clientCount = 0
    this.validateOptions()
    this.inLog = (...args) => console.debug('S', ...args)
    this.outLog = (...args) => console.debug('S', ...args)
  }

  validateOptions() {
    if (this.options.version < Options.MIN_VERSION) {
      throw new Error(`Unsupported protocol version < ${Options.MIN_VERSION} : ${this.options.version}`)
    }
  }

  onOpenConnection = (conn) => {
    this.inLog('new connection', conn)
    const player = new Player(this, conn)
    this.clients[conn.address] = player
    this.clientCount++
    this.emit('connect', { client: player })
  }

  onCloseConnection = (inetAddr, reason) => {
    debug('close connection', inetAddr, reason)
    delete this.clients[inetAddr]
    this.clientCount--
  }

  onEncapsulated = (buffer, address) => {
    debug(address, 'Encapsulated', buffer)
    const client = this.clients[address]
    if (!client) {
      throw new Error(`packet from unknown inet addr: ${address}`)
    }
    client.handle(buffer)
  }

  async create(hostname = this.options.hostname, port = this.options.port) {
    this.raknet = new RakServer({ hostname, port })
    await this.raknet.listen()
    console.debug('Listening on', hostname, port)
    this.raknet.onOpenConnection = this.onOpenConnection
    this.raknet.onCloseConnection = this.onCloseConnection
    this.raknet.onEncapsulated = this.onEncapsulated
  }
}

const hash = (inetAddr) => inetAddr.address + '/' + inetAddr.port

module.exports = { Server }