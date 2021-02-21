const Listener = require('jsp-raknet/listener')
const { EventEmitter } = require('events')
const { createDeserializer, createSerializer } = require('./transforms/serializer')
const { Player } = require('./serverPlayer')

const Options = require('./options')
const debug = require('debug')('minecraft-protocol')

class Server extends EventEmitter {
  constructor(options) {
    super()
    this.options = { ...Options.defaultOptions, options }
    this.serializer = createSerializer()
    this.deserializer = createDeserializer()
    this.clients = {}
    this.validateOptions()
  }

  validateOptions() {
    if (this.options.version < Options.MIN_VERSION) {
      throw new Error(`Unsupported protocol version < ${Options.MIN_VERSION} : ${this.options.version}`)
    }
  }

  onOpenConnection = (conn) => {
    debug('new connection', conn)
    const player = new Player(this, conn)
    this.clients[hash(conn.address)] = player

    this.emit('connect', { client: player })
  }

  onCloseConnection = (inetAddr, reason) => {
    debug('close connection', inetAddr, reason)
    delete this.clients[hash(inetAddr)]
  }

  onEncapsulated = (encapsulated, inetAddr) => {
    debug(inetAddr.address, 'Encapsulated', encapsulated)
    const buffer = encapsulated.buffer
    const client = this.clients[hash(inetAddr)]
    if (!client) {
      throw new Error(`packet from unknown inet addr: ${inetAddr.address}/${inetAddr.port}`)
    }
    client.handle(buffer)
  }

  async create(serverIp, port) {
    this.listener = new Listener(this)
    this.raknet = await this.listener.listen(serverIp, port)
    console.debug('Listening on', serverIp, port)

    this.raknet.on('openConnection', this.onOpenConnection)
    this.raknet.on('closeConnection', this.onCloseConnection)
    this.raknet.on('encapsulated', this.onEncapsulated)

    this.raknet.on('raw', (buffer, inetAddr) => {
      debug('Raw packet', buffer, inetAddr)
    })
  }
}

const hash = (inetAddr) => inetAddr.address + '/' + inetAddr.port

module.exports = { Server }