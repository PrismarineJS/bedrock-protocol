const { ClientStatus, Connection } = require('./connection')
const { createDeserializer, createSerializer } = require('./transforms/serializer')
const { RakClient } = require('./rak')
const { serialize } = require('./datatypes/util')
const fs = require('fs')
const debug = require('debug')('minecraft-protocol')
const Options = require('./options')
const auth = require('./client/auth')

const { Encrypt } = require('./auth/encryption')
const Login = require('./auth/login')
const LoginVerify = require('./auth/loginVerify')

const debugging = false

class Client extends Connection {
  // The RakNet connection
  connection

  /** @param {{ version: number, hostname: string, port: number }} options */
  constructor (options) {
    super()
    this.options = { ...Options.defaultOptions, ...options }
    this.validateOptions()
    this.serializer = createSerializer(this.options.version)
    this.deserializer = createDeserializer(this.options.version)

    Encrypt(this, null, this.options)
    Login(this, null, this.options)
    LoginVerify(this, null, this.options)

    this.on('session', this.connect)

    if (options.offline) {
      console.debug('offline mode, not authenticating', this.options)
      auth.createOfflineSession(this, this.options)
    } else if (options.password) {
      auth.authenticatePassword(this, this.options)
    } else {
      auth.authenticateDeviceCode(this, this.options)
    }

    this.startGameData = {}
    this.clientRuntimeId = null

    this.startQueue()
    this.inLog = (...args) => debug('C ->', ...args)
    this.outLog = (...args) => debug('C <-', ...args)
  }

  validateOptions () {
    if (!this.options.hostname || this.options.port == null) throw Error('Invalid hostname/port')

    if (!Options.Versions[this.options.version]) {
      console.warn('Supported versions: ', Options.Versions)
      throw Error(`Unsupported version ${this.options.version}`)
    }
    this.options.protocolVersion = Options.Versions[this.options.version]
    if (this.options.protocolVersion < Options.MIN_VERSION) {
      throw new Error(`Protocol version < ${Options.MIN_VERSION} : ${this.options.protocolVersion}, too old`)
    }
  }

  get entityId() {
    return this.startGameData.runtime_entity_id
  }

  onEncapsulated = (encapsulated, inetAddr) => {
    const buffer = Buffer.from(encapsulated.buffer)
    this.handle(buffer)
  }

  connect = async (sessionData) => {
    const hostname = this.options.hostname
    const port = this.options.port
    debug('[client] connecting to', hostname, port, sessionData)

    this.connection = new RakClient({ useWorkers: true, hostname, port })
    this.connection.onConnected = () => this.sendLogin()
    this.connection.onCloseConnection = () => this.close()
    this.connection.onEncapsulated = this.onEncapsulated
    this.connection.connect()

    this.connectTimer = setTimeout(() => {
      if (this.status === ClientStatus.Disconnected) {
        this.connection.close()
        this.emit('error', 'connect timed out')
      }
    }, this.options.connectTimeout || 9000)
  }

  sendLogin () {
    this.status = ClientStatus.Authenticating
    this.createClientChain(null, this.options.offline)

    const chain = [
      this.clientIdentityChain, // JWT we generated for auth
      ...this.accessToken // Mojang + Xbox JWT from auth
    ]

    const encodedChain = JSON.stringify({ chain })
    const bodyLength = this.clientUserChain.length + encodedChain.length + 8

    debug('Auth chain', chain)

    this.write('login', {
      protocol_version: this.options.protocolVersion,
      payload_size: bodyLength,
      chain: encodedChain,
      client_data: this.clientUserChain
    })
    this.emit('loggingIn')
  }

  onDisconnectRequest (packet) {
    console.warn(`C Server requested ${packet.hide_disconnect_reason ? 'silent disconnect' : 'disconnect'}: ${packet.message}`)
    this.emit('kick', packet)
  }

  onPlayStatus (statusPacket) {
    if (this.status === ClientStatus.Initializing && this.options.autoInitPlayer === true) {
      if (statusPacket.status === 'player_spawn') {
        this.status = ClientStatus.Initialized
        this.write('set_local_player_as_initialized', { runtime_entity_id: this.entityId })
        this.emit('spawn')
      }
    }
  }

  close () {
    this.emit('close')
    clearInterval(this.loop)
    clearTimeout(this.connectTimeout)
    this.q = []
    this.q2 = []
    this.connection?.close()
    this.removeAllListeners()
    console.log('Client closed!')
  }

  tryRencode (name, params, actual) {
    const packet = this.serializer.createPacketBuffer({ name, params })

    console.assert(packet.toString('hex') === actual.toString('hex'))
    if (packet.toString('hex') !== actual.toString('hex')) {
      const ours = packet.toString('hex').match(/.{1,16}/g).join('\n')
      const theirs = actual.toString('hex').match(/.{1,16}/g).join('\n')

      fs.writeFileSync('ours.txt', ours)
      fs.writeFileSync('theirs.txt', theirs)
      fs.writeFileSync('ours.json', serialize(params))
      fs.writeFileSync('theirs.json', serialize(this.deserializer.parsePacketBuffer(packet).data.params))

      throw new Error(name + ' Packet comparison failed!')
    }
  }

  readPacket (packet) {
    const des = this.deserializer.parsePacketBuffer(packet)
    const pakData = { name: des.data.name, params: des.data.params }
    this.inLog('-> C', pakData.name/*, serialize(pakData.params).slice(0, 100) */)
    this.emit('packet', des)

    if (debugging) {
      // Packet verifying (decode + re-encode + match test)
      if (pakData.name) {
        this.tryRencode(pakData.name, pakData.params, packet)
      }
    }

    // Abstract some boilerplate before sending to listeners
    switch (des.data.name) {
      case 'server_to_client_handshake':
        this.emit('client.server_handshake', des.data.params)
        break
      case 'disconnect': // Client kicked
        this.onDisconnectRequest(des.data.params)
        break
      case 'start_game':
        this.startGameData = pakData.params
        break
      case 'play_status':
        this.onPlayStatus(pakData.params)
        break
      default:
        if (this.status !== ClientStatus.Initializing && this.status !== ClientStatus.Initialized) {
          this.inLog(`Can't accept ${des.data.name}, client not yet authenticated : ${this.status}`)
          return
        }
    }

    // Emit packet
    this.emit(des.data.name, des.data.params)
  }
}

module.exports = { Client }
