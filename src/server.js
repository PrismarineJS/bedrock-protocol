const Listener = require('@jsprismarine/raknet/listener')
const { EventEmitter } = require('events')
const { createDeserializer, createSerializer } = require('./transforms/serializer')
const { Encrypt } = require('./auth/encryption')
const { decodeLoginJWT } = require('./auth/chains')
const { Connection } = require('./connection')
const Options = require('./options')

const log = (...args) => console.log(...args)

class Player extends Connection {
  constructor(server, connection, options) {
    super()
    this.server = server
    this.serializer = server.serializer
    this.connection = connection
    Encrypt(this, server, options)
  }

  getData() {
    return this.userData
  }

  onLogin(packet) {
    let body = packet.data
    console.log('Body', body)

    const clientVer = body.protocol_version
    if (this.server.options.version) {
      if (this.server.options.version < clientVer) {
        this.sendDisconnectStatus(failed_client)
        return
      }
    } else if (clientVer < MIN_VERSION) {
      this.sendDisconnectStatus(failed_client)
      return
    }

    // Parse login data
    const authChain = JSON.parse(body.params.chain)
    const skinChain = body.params.client_data

    try {
      var { key, userData, chain } = decodeLoginJWT(authChain.chain, skinChain)
    } catch (e) {
      console.error(e)
      throw new Error('Failed to verify user')
    }
    console.log('Verified user', 'got pub key', key, userData)

    this.emit('login', { user: userData.extraData }) // emit events for user
    this.emit('server.client_handshake', { key }) // internal so we start encryption

    this.userData = userData.extraData
    this.version = clientVer
  }

  sendDisconnectStatus(play_status) {
    this.write('play_status', { status: play_status })
    this.connection.close()
  }

  // After sending Server to Client Handshake, this handles the client's
  // Client to Server handshake response. This indicates successful encryption
  onHandshake() {
    // https://wiki.vg/Bedrock_Protocol#Play_Status
    this.write('play_status', { status: 'login_success' })
    this.emit('join')
  }

  readPacket(packet) {
    console.log('packet', packet)
    const des = this.server.deserializer.parsePacketBuffer(packet)
    console.log('->', des)
    switch (des.data.name) {
      case 'login':
        console.log(des)
        this.onLogin(des)
        return
      case 'client_to_server_handshake':
        this.onHandshake()
      default:
        console.log('ignoring, unhandled')
    }
    this.emit(des.data.name, des.data.params)
  }
}

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

  getAddrHash(inetAddr) {
    return inetAddr.address + '/' + inetAddr.port
  }

  onOpenConnection = (conn) => {
    log('new connection', conn)
    const player = new Player(this, conn)
    this.clients[this.getAddrHash(conn.address)] = player

    this.emit('connect', { client: player })
  }

  onCloseConnection = (inetAddr, reason) => {
    log('close connection', inetAddr, reason)
    delete this.clients[this.getAddrHash(inetAddr)]
  }

  onEncapsulated = (encapsulated, inetAddr) => {
    log(inetAddr.address, ': Encapsulated', encapsulated)
    const buffer = encapsulated.buffer
    const client = this.clients[this.getAddrHash(inetAddr)]
    if (!client) {
      throw new Error(`packet from unknown inet addr: ${inetAddr.address}/${inetAddr.port}`)
    }
    client.handle(buffer)
  }

  async create(serverIp, port) {
    this.listener = new Listener(this)
    this.raknet = await this.listener.listen(serverIp, port)
    log('Listening on', serverIp, port)

    this.raknet.on('openConnection', this.onOpenConnection)
    this.raknet.on('closeConnection', this.onCloseConnection)
    this.raknet.on('encapsulated', this.onEncapsulated)

    this.raknet.on('raw', (buffer, inetAddr) => {
      console.log('Raw packet', buffer, inetAddr)
    })
  }
}

module.exports = { Server, Player }