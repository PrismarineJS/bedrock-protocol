const { ClientStatus, Connection } = require('./connection')
const Options = require('./options')
const { serialize, isDebug } = require('./datatypes/util')
const { createKeyExchange } = require('./handshake/keyExchange')
const Login = require('./handshake/login')
const LoginVerify = require('./handshake/loginVerify')
const { createLoginVerifier } = require('./auth/loginVerifier')
const { parseLoginEnvelope } = require('./auth/loginEnvelope')
const { LoginPhase, LoginState } = require('./auth/loginState')
const debug = require('debug')('minecraft-protocol')

class Player extends Connection {
  constructor (server, connection) {
    super()
    this.server = server
    this.features = server.features
    this.serializer = server.serializer
    this.deserializer = server.deserializer
    this.connection = connection
    this.options = server.options

    this.keyExchange = createKeyExchange()
    this.ecdhKeyPair = this.keyExchange.keyPair
    this.publicKeyDER = this.keyExchange.publicKeyDER
    this.privateKeyPEM = this.keyExchange.privateKeyPEM
    this.clientX509 = this.keyExchange.clientX509
    Login(this, server, server.options)
    this.loginVerifier = createLoginVerifier(server.options)
    LoginVerify(this, server, server.options, { loginVerifier: this.loginVerifier })

    this.startQueue()
    this.status = ClientStatus.Authenticating

    if (isDebug) {
      this.inLog = (...args) => debug('-> S', ...args)
      this.outLog = (...args) => debug('<- S', ...args)
    }

    this.batchHeader = this.server.batchHeader
    // Compression is server-wide
    this.compressionAlgorithm = this.server.compressionAlgorithm
    this.compressionLevel = this.server.compressionLevel
    this.compressionThreshold = this.server.compressionThreshold
    this.compressionHeader = this.server.compressionHeader

    this._sentNetworkSettings = false // 1.19.30+
    this.loginState = new LoginState()
  }

  getUserData () {
    return this.userData
  }

  getAuthentication () {
    return this.authentication
  }

  sendNetworkSettings () {
    this.write('network_settings', {
      compression_threshold: this.server.compressionThreshold,
      compression_algorithm: this.server.compressionAlgorithm,
      client_throttle: false,
      client_throttle_threshold: 0,
      client_throttle_scalar: 0
    })
    this._sentNetworkSettings = true
    this.compressionReady = true
  }

  handleClientProtocolVersion (clientVersion) {
    if (this.server.options.protocolVersion) {
      if (this.server.options.protocolVersion < clientVersion) {
        this.sendDisconnectStatus('failed_spawn') // client too new
        return false
      }
    } else if (clientVersion < Options.MIN_VERSION) {
      this.sendDisconnectStatus('failed_client') // client too old
      return false
    }
    return true
  }

  async onLogin (packet) {
    try {
      this.loginState.transition(LoginPhase.VerifyingLogin)
      const envelope = parseLoginEnvelope(packet)
      // Compatibility notification containing raw, unverified input. Parsing
      // happens first so listeners cannot alter what the verifier consumes.
      this.emit('loggingIn', packet.data)
      if (!this.handleClientProtocolVersion(envelope.protocolVersion)) {
        this.loginState.reject()
        return
      }

      const verified = await this.loginVerifier.verifyLogin(envelope)
      this.loginState.require(LoginPhase.VerifyingLogin)
      this.authentication = verified.authentication
      this.userData = verified.identity
      this.skinData = verified.clientData
      this.profile = {
        name: verified.identity.displayName,
        uuid: verified.identity.identity,
        xuid: verified.identity.XUID
      }
      this.version = envelope.protocolVersion

      const handshake = this.keyExchange.createServerHandshake(verified.clientPublicKey)
      this.write('server_to_client_handshake', { token: handshake.token })
      this.enableEncryption(handshake)
      this.loginState.transition(LoginPhase.AwaitingClientHandshake)
      this.emit('login', { user: verified.identity, authentication: verified.authentication })
    } catch (e) {
      this.rejectLogin(e)
    }
  }

  rejectLogin (error) {
    if (!this.loginState.reject()) return
    debug(this.address, error)
    this.disconnect('Server authentication error')
  }

  /**
   * Disconnects a client before it has joined
   * @param {string} playStatus
   */
  sendDisconnectStatus (playStatus) {
    if (this.status === ClientStatus.Disconnected) return
    this.write('play_status', { status: playStatus })
    this.close('kick')
  }

  /**
   * Disconnects a client
   */
  disconnect (reason = 'Server closed', hide = false) {
    if (this.status === ClientStatus.Disconnected) return
    this.write('disconnect', {
      hide_disconnect_screen: hide,
      message: reason,
      filtered_message: ''
    })
    this.server.conLog('Kicked ', this.connection?.address, reason)
    setTimeout(() => this.close('kick'), 100) // Allow time for message to be recieved.
  }

  // After sending Server to Client Handshake, this handles the client's
  // Client to Server handshake response. This indicates successful encryption
  onHandshake () {
    try {
      this.loginState.require(LoginPhase.AwaitingClientHandshake)
      if (this.status !== ClientStatus.Authenticating || !this.encryptionEnabled) {
        throw new Error('Client handshake arrived before encryption was enabled')
      }
      this.loginState.transition(LoginPhase.Complete)
    } catch (error) {
      this.rejectLogin(error)
      return false
    }

    // https://wiki.vg/Bedrock_Protocol#Play_Status
    this.status = ClientStatus.Initializing
    this.write('play_status', { status: 'login_success' })
    this.emit('join')
    return true
  }

  close (reason) {
    if (this.status !== ClientStatus.Disconnected) {
      this.emit('close') // Emit close once
      if (!reason) this.inLog?.('Client closed connection', this.connection?.address)
    }
    this.q = []
    this.q2 = []
    clearInterval(this.loop)
    this.connection?.close()
    this.removeAllListeners()
    this.status = ClientStatus.Disconnected
    this.loginState?.close()
  }

  readPacket (packet) {
    if (this.loginState.is(LoginPhase.Rejected) || this.loginState.is(LoginPhase.Closed)) return

    try {
      var des = this.server.deserializer.parsePacketBuffer(packet) // eslint-disable-line
    } catch (e) {
      this.disconnect('Server error')
      debug('Dropping packet from', this.connection.address, e)
      return
    }

    this.inLog?.(des.data.name, serialize(des.data.params))

    switch (des.data.name) {
      // This is the first packet on 1.19.30 & above
      case 'request_network_settings':
        if (!this.loginState.is(LoginPhase.AwaitingLogin)) {
          this.rejectLogin(new Error('Network settings request arrived after login started'))
          return
        }
        if (this.handleClientProtocolVersion(des.data.params.client_protocol)) {
          this.sendNetworkSettings()
          this.compressionLevel = this.server.compressionLevel
        }
        return
      // Below 1.19.30, this is the first packet.
      case 'login':
        this.onLogin(des).catch(error => this.rejectLogin(error))
        if (!this._sentNetworkSettings) this.sendNetworkSettings()
        return
      case 'client_to_server_handshake':
        // Emit the 'join' event
        if (!this.onHandshake()) return
        break
      case 'set_local_player_as_initialized':
        if (!this.loginState.is(LoginPhase.Complete) || this.status !== ClientStatus.Initializing) {
          this.rejectLogin(new Error('Player initialization arrived before login completed'))
          return
        }
        this.status = ClientStatus.Initialized
        this.inLog?.('Server client spawned')
        // Emit the 'spawn' event
        this.emit('spawn')
        break
      default:
        if (!this.loginState.is(LoginPhase.Complete) || this.status === ClientStatus.Disconnected || this.status === ClientStatus.Authenticating) {
          this.inLog?.('ignoring', des.data.name)
          return
        }
    }
    this.emit(des.data.name, des.data.params)
    this.emit('packet', des)
  }
}

module.exports = { Player }
