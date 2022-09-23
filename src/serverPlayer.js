const { ClientStatus, Connection } = require('./connection')
const Options = require('./options')
const { serialize, isDebug } = require('./datatypes/util')
const { KeyExchange } = require('./handshake/keyExchange')
const Login = require('./handshake/login')
const LoginVerify = require('./handshake/loginVerify')
const debug = require('debug')('minecraft-protocol')

class Player extends Connection {
  constructor (server, connection) {
    super()
    this.server = server
    this.serializer = server.serializer
    this.deserializer = server.deserializer
    this.connection = connection
    this.options = server.options

    KeyExchange(this, server, server.options)
    Login(this, server, server.options)
    LoginVerify(this, server, server.options)

    this.startQueue()
    this.status = ClientStatus.Authenticating

    if (isDebug) {
      this.inLog = (...args) => debug('S ->', ...args)
      this.outLog = (...args) => debug('S <-', ...args)
    }

    // Compression is server-wide
    this.compressionAlgorithm = this.server.compressionAlgorithm
    this.compressionLevel = this.server.compressionLevel
    this.compressionThreshold = this.server.compressionThreshold

    this._sentNetworkSettings = false // 1.19.30+
  }

  getUserData () {
    return this.userData
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

  onLogin (packet) {
    const body = packet.data
    this.emit('loggingIn', body)

    const clientVer = body.params.protocol_version
    if (!this.handleClientProtocolVersion(clientVer)) {
      return
    }

    // Parse login data
    const tokens = body.params.tokens
    const authChain = JSON.parse(tokens.identity)
    const skinChain = tokens.client

    try {
      var { key, userData, skinData } = this.decodeLoginJWT(authChain.chain, skinChain) // eslint-disable-line
    } catch (e) {
      debug(this.address, e)
      this.disconnect('Server authentication error')
      return
    }

    this.emit('server.client_handshake', { key }) // internal so we start encryption

    this.userData = userData.extraData
    this.skinData = skinData
    this.profile = {
      name: userData.extraData?.displayName,
      uuid: userData.extraData?.identity,
      xuid: userData.extraData?.xuid || userData.extraData?.XUID
    }
    this.version = clientVer
    this.emit('login', { user: userData.extraData }) // emit events for user
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
      message: reason
    })
    this.server.conLog('Kicked ', this.connection?.address, reason)
    setTimeout(() => this.close('kick'), 100) // Allow time for message to be recieved.
  }

  // After sending Server to Client Handshake, this handles the client's
  // Client to Server handshake response. This indicates successful encryption
  onHandshake () {
    // https://wiki.vg/Bedrock_Protocol#Play_Status
    this.write('play_status', { status: 'login_success' })
    this.status = ClientStatus.Initializing
    this.emit('join')
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
  }

  readPacket (packet) {
    try {
      var des = this.server.deserializer.parsePacketBuffer(packet) // eslint-disable-line
    } catch (e) {
      this.disconnect('Server error')
      debug('Dropping packet from', this.connection.address, e)
      return
    }

    this.inLog?.(des.data.name, serialize(des.data.params).slice(0, 200))

    switch (des.data.name) {
      // This is the first packet on 1.19.30 & above
      case 'request_network_settings':
        if (this.handleClientProtocolVersion(des.data.params.client_protocol)) {
          this.sendNetworkSettings()
          this.compressionLevel = this.server.compressionLevel
        }
        return
      // Below 1.19.30, this is the first packet.
      case 'login':
        this.onLogin(des)
        if (!this._sentNetworkSettings) this.sendNetworkSettings()
        return
      case 'client_to_server_handshake':
        // Emit the 'join' event
        this.onHandshake()
        break
      case 'set_local_player_as_initialized':
        this.status = ClientStatus.Initialized
        this.inLog?.('Server client spawned')
        // Emit the 'spawn' event
        this.emit('spawn')
        break
      default:
        if (this.status === ClientStatus.Disconnected || this.status === ClientStatus.Authenticating) {
          this.inLog?.('ignoring', des.data.name)
          return
        }
    }
    this.emit(des.data.name, des.data.params)
    this.emit('packet', des)
  }
}

module.exports = { Player }
