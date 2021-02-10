const RakClient = require('@jsprismarine/raknet/client')
const { Connection } = require('./connection')
const { createDeserializer, createSerializer } = require('./transforms/serializer')
const { Encrypt } = require('./auth/encryption')
const auth = require('./client/auth')
const Options = require('./options')

class Client extends Connection {
  constructor(options) {
    super()
    this.options = { ...Options.defaultOptions, options }
    this.serializer = createSerializer()
    this.deserializer = createDeserializer()
    this.validateOptions()

    Encrypt(this, null, options)

    if (options.password) {
      auth.authenticatePassword(this, options)
    } else {
      auth.authenticateDeviceCode(this, options)
    }

    this.on('session', this.connect)
  }

  validateOptions() {
    if (this.options.version < Options.MIN_VERSION) {
      throw new Error(`Unsupported protocol version < ${Options.MIN_VERSION} : ${this.options.version}`)
    }
  }

  onEncapsulated = (encapsulated, inetAddr) => {
    log(inetAddr.address, ': Encapsulated', encapsulated)
    const buffer = encapsulated.buffer
    this.handle(buffer)
  }

  connect = async (sessionData) => {
    console.log('Got session data', sessionData)

    if (this.raknet) return

    this.raknet = new RakClient('localhost', 19132)
    await this.raknet.connect()

    this.raknet.on('connecting', () => {
      // console.log(`[client] connecting to ${hostname}/${port}`)
    })
    this.raknet.on('connected', (connection) => {
      console.log(`[client] connected!`)
      this.connection = connection
      this.sendLogin()
    })

    this.raknet.on('encapsulated', this.onEncapsulated)

    this.raknet.on('raw', (buffer, inetAddr) => {
      console.log('Raw packet', buffer, inetAddr)
    })
  }

  sendLogin() {

    const chain = [
      this.clientChain, // JWT we generated for auth
      ...this.accessToken // Mojang + Xbox JWT from auth
    ]

    const encodedChain = JSON.stringify({ chain })
    const skinChain = JSON.stringify({})

    const bodyLength = skinChain.length + encodedChain.length + 8

    console.log('Auth chain', chain)

    this.write('login', {
      protocol_version: this.options.version,
      payload_size: bodyLength,
      chain: encodedChain,
      client_data: skinChain
    })
  }

  // After sending Server to Client Handshake, this handles the client's
  // Client to Server handshake response. This indicates successful encryption
  onHandshake() {
    // https://wiki.vg/Bedrock_Protocol#Play_Status
    this.write('play_status', { status: PLAY_STATUS.LoginSuccess })
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

module.exports = { Client }