const { ClientStatus, Connection } = require('./connection')
const { createDeserializer, createSerializer } = require('./transforms/serializer')
const { RakClient } = require('./rak')
const { serialize, isDebug } = require('./datatypes/util')
const debug = require('debug')('minecraft-protocol')
const Options = require('./options')
const auth = require('./client/auth')

const { KeyExchange } = require('./handshake/keyExchange')
const Login = require('./handshake/login')
const LoginVerify = require('./handshake/loginVerify')

const debugging = false

class Client extends Connection {
  // The RakNet connection
  connection

  /** @param {{ version: number, host: string, port: number }} options */
  constructor (options) {
    super()
    this.options = { ...Options.defaultOptions, ...options }
    this.validateOptions()
    this.serializer = createSerializer(this.options.version)
    this.deserializer = createDeserializer(this.options.version)

    KeyExchange(this, null, this.options)
    Login(this, null, this.options)
    LoginVerify(this, null, this.options)

    const host = this.options.host
    const port = this.options.port
    this.connection = new RakClient({ useWorkers: true, host, port })

    this.startGameData = {}
    this.clientRuntimeId = null

    if (isDebug) {
      this.inLog = (...args) => debug('C ->', ...args)
      this.outLog = (...args) => debug('C <-', ...args)
    }
  }

  connect () {
    this.on('session', this._connect)

    if (this.options.offline) {
      debug('offline mode, not authenticating', this.options)
      auth.createOfflineSession(this, this.options)
    } else {
      auth.authenticateDeviceCode(this, this.options)
    }

    this.startQueue()
  }

  validateOptions () {
    if (!this.options.host || this.options.port == null) throw Error('Invalid host/port')

    if (!Options.Versions[this.options.version]) {
      console.warn('Supported versions: ', Options.Versions)
      throw Error(`Unsupported version ${this.options.version}`)
    }
    this.options.protocolVersion = Options.Versions[this.options.version]
    if (this.options.protocolVersion < Options.MIN_VERSION) {
      throw new Error(`Protocol version < ${Options.MIN_VERSION} : ${this.options.protocolVersion}, too old`)
    }
  }

  get entityId () {
    return this.startGameData.runtime_entity_id
  }

  onEncapsulated = (encapsulated, inetAddr) => {
    const buffer = Buffer.from(encapsulated.buffer)
    this.handle(buffer)
  }

  async ping () {
    try {
      return await this.connection.ping(this.options.connectTimeout)
    } catch (e) {
      console.warn(`Unable to connect to [${this.options.host}]/${this.options.port}. Is the server running?`)
      throw e
    }
  }

  _connect = async (sessionData) => {
    debug('[client] connecting to', this.options.host, this.options.port, sessionData, this.connection)
    this.connection.onConnected = () => this.sendLogin()
    this.connection.onCloseConnection = () => this.close()
    this.connection.onEncapsulated = this.onEncapsulated
    this.connection.connect()

    this.connectTimeout = setTimeout(() => {
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

    debug('Auth chain', chain)

    this.write('login', {
      protocol_version: this.options.protocolVersion,
      tokens: {
        identity: encodedChain,
        client: this.clientUserChain
      }
    })
    this.emit('loggingIn')
  }

  onDisconnectRequest (packet) {
    console.warn(`Server requested ${packet.hide_disconnect_reason ? 'silent disconnect' : 'disconnect'}: ${packet.message}`)
    this.emit('kick', packet)
    this.close()
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
    if (this.status !== ClientStatus.Disconnected) {
      this.emit('close') // Emit close once
      debug('Client closed!')
    }
    clearInterval(this.loop)
    clearTimeout(this.connectTimeout)
    this.q = []
    this.q2 = []
    this.connection?.close()
    this.removeAllListeners()
    this.status = ClientStatus.Disconnected
  }

  readPacket (packet) {
    const des = this.deserializer.parsePacketBuffer(packet)
    const pakData = { name: des.data.name, params: des.data.params }
    this.inLog?.('-> C', pakData.name, this.options.loggging ? serialize(pakData.params) : '')
    this.emit('packet', des)

    if (debugging) {
      // Packet verifying (decode + re-encode + match test)
      if (pakData.name) {
        this.deserializer.verify(packet, this.serializer)
      }
    }

    // Abstract some boilerplate before sending to listeners
    switch (des.data.name) {
      case 'server_to_client_handshake':
        this.emit('client.server_handshake', des.data.params)
        break
      case 'disconnect': // Client kicked
        this.emit(des.data.name, des.data.params) // Emit before we kill all listeners.
        this.onDisconnectRequest(des.data.params)
        break
      case 'start_game':
        this.startGameData = pakData.params
        this.startGameData.itemstates.forEach(state => {
          if (state.name === 'minecraft:shield') {
            this.serializer.proto.setVariable('ShieldItemID', state.runtime_id)
            this.deserializer.proto.setVariable('ShieldItemID', state.runtime_id)
          }
        })
        break
      case 'play_status':
        if (this.status === ClientStatus.Authenticating) {
          this.inLog?.('Server wants to skip encryption')
          this.emit('join')
          this.status = ClientStatus.Initializing
        }
        this.onPlayStatus(pakData.params)
        break
      default:
        if (this.status !== ClientStatus.Initializing && this.status !== ClientStatus.Initialized) {
          // TODO: standardjs bug happens here with ?.(`something ${des.data.name}`)
          if (this.inLog) this.inLog(`Can't accept ${des.data.name}, client not yet authenticated : ${this.status}`)
          return
        }
    }

    // Emit packet
    this.emit(des.data.name, des.data.params)
  }
}

module.exports = { Client }
