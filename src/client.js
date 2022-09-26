const { ClientStatus, Connection } = require('./connection')
const { createDeserializer, createSerializer } = require('./transforms/serializer')
const { serialize, isDebug } = require('./datatypes/util')
const debug = require('debug')('minecraft-protocol')
const Options = require('./options')
const auth = require('./client/auth')
const initRaknet = require('./rak')
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

    this.startGameData = {}
    this.clientRuntimeId = null
    // Start off without compression on 1.19.30, zlib on below
    this.compressionAlgorithm = this.versionGreaterThanOrEqualTo('1.19.30') ? 'none' : 'deflate'
    this.compressionThreshold = 512
    this.compressionLevel = this.options.compressionLevel

    if (isDebug) {
      this.inLog = (...args) => debug('C ->', ...args)
      this.outLog = (...args) => debug('C <-', ...args)
    }
    this.conLog = this.options.conLog === undefined ? console.log : this.options.conLog

    if (!options.delayedInit) {
      this.init()
    }
  }

  init () {
    this.validateOptions()
    this.serializer = createSerializer(this.options.version)
    this.deserializer = createDeserializer(this.options.version)

    KeyExchange(this, null, this.options)
    Login(this, null, this.options)
    LoginVerify(this, null, this.options)

    const { RakClient } = initRaknet(this.options.raknetBackend)
    const host = this.options.host
    const port = this.options.port
    this.connection = new RakClient({ useWorkers: this.options.useRaknetWorkers, host, port }, this)

    this.emit('connect_allowed')
  }

  connect () {
    if (!this.connection) throw new Error('Connect not currently allowed') // must wait for `connect_allowed`, or use `createClient`
    this.on('session', this._connect)

    if (this.options.offline) {
      debug('offline mode, not authenticating', this.options)
      auth.createOfflineSession(this, this.options)
    } else {
      auth.authenticate(this, this.options)
    }

    this.startQueue()
  }

  validateOptions () {
    if (!this.options.host || this.options.port == null) throw Error('Invalid host/port')
    Options.validateOptions(this.options)
  }

  get entityId () {
    return this.startGameData.runtime_entity_id
  }

  onEncapsulated = (encapsulated, inetAddr) => {
    const buffer = Buffer.from(encapsulated.buffer)
    process.nextTick(() => this.handle(buffer))
  }

  async ping () {
    try {
      return await this.connection.ping(this.options.connectTimeout)
    } catch (e) {
      this.conLog?.(`Unable to connect to [${this.options.host}]/${this.options.port}. Is the server running?`)
      throw e
    }
  }

  _connect = async (sessionData) => {
    debug('[client] connecting to', this.options.host, this.options.port, sessionData, this.connection)
    this.connection.onConnected = () => {
      this.status = ClientStatus.Connecting
      if (this.versionGreaterThanOrEqualTo('1.19.30')) {
        this.queue('request_network_settings', { client_protocol: this.options.protocolVersion })
      } else {
        this.sendLogin()
      }
    }
    this.connection.onCloseConnection = (reason) => {
      if (this.status === ClientStatus.Disconnected) this.conLog?.(`Server closed connection: ${reason}`)
      this.close()
    }
    this.connection.onEncapsulated = this.onEncapsulated
    this.connection.connect()

    this.connectTimeout = setTimeout(() => {
      if (this.status === ClientStatus.Disconnected) {
        this.connection.close()
        this.emit('error', 'connect timed out')
      }
    }, this.options.connectTimeout || 9000)
  }

  updateCompressorSettings (packet) {
    this.compressionAlgorithm = packet.compression_algorithm || 'deflate'
    this.compressionThreshold = packet.compression_threshold
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
    this.conLog?.(`Server requested ${packet.hide_disconnect_reason ? 'silent disconnect' : 'disconnect'}: ${packet.message}`)
    this.emit('kick', packet)
    this.close()
  }

  onPlayStatus (statusPacket) {
    if (this.status === ClientStatus.Initializing && this.options.autoInitPlayer === true) {
      if (statusPacket.status === 'player_spawn') {
        this.status = ClientStatus.Initialized
        if (!this.entityId) {
          // We need to wait for start_game in the rare event we get a player_spawn before start_game race condition
          this.on('start_game', () => this.write('set_local_player_as_initialized', { runtime_entity_id: this.entityId }))
        } else {
          this.write('set_local_player_as_initialized', { runtime_entity_id: this.entityId })
        }
        this.emit('spawn')
      }
    }
  }

  disconnect (reason = 'Client leaving', hide = false) {
    if (this.status === ClientStatus.Disconnected) return
    this.write('disconnect', {
      hide_disconnect_screen: hide,
      message: reason
    })
    this.close(reason)
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
    try {
      var des = this.deserializer.parsePacketBuffer(packet) // eslint-disable-line
    } catch (e) {
      // Dump information about the packet only if user is not handling error event.
      if (this.listenerCount('error') === 0) this.deserializer.dumpFailedBuffer(packet)
      this.emit('error', e)
      return
    }
    const pakData = { name: des.data.name, params: des.data.params }
    this.inLog?.('-> C', pakData.name, this.options.logging ? serialize(pakData.params) : '')
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
      case 'network_settings':
        this.updateCompressorSettings(des.data.params)
        if (this.status === ClientStatus.Connecting) {
          this.sendLogin()
        }
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
          this.inLog?.(`Can't accept ${des.data.name}, client not yet authenticated : ${this.status}`)
          return
        }
    }

    // Emit packet
    this.emit(des.data.name, des.data.params)
  }
}

module.exports = { Client }
