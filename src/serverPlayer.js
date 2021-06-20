const { ClientStatus, Connection } = require('./connection')
const Options = require('./options')
const { serialize, isDebug } = require('./datatypes/util')
const { KeyExchange } = require('./handshake/keyExchange')
const Login = require('./handshake/login')
const LoginVerify = require('./handshake/loginVerify')
const fs = require('fs')
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
  }

  getUserData () {
    return this.userData
  }

  onLogin (packet) {
    const body = packet.data
    this.emit('loggingIn', body)

    const clientVer = body.protocol_version
    if (this.server.options.protocolVersion) {
      if (this.server.options.protocolVersion < clientVer) {
        this.sendDisconnectStatus('failed_spawn')
        return
      }
    } else if (clientVer < Options.MIN_VERSION) {
      this.sendDisconnectStatus('failed_client')
      return
    }

    // Parse login data
    const tokens = body.params.tokens
    const authChain = JSON.parse(tokens.identity)
    const skinChain = tokens.client

    try {
      var { key, userData, skinData } = this.decodeLoginJWT(authChain.chain, skinChain) // eslint-disable-line
    } catch (e) {
      console.error(e)
      console.debug(authChain.chain, skinChain)
      this.disconnect('Server authentication error')
      return
    }

    this.emit('server.client_handshake', { key }) // internal so we start encryption

    this.userData = userData.extraData
    this.skinData = skinData
    this.profile = {
      name: userData.extraData?.displayName,
      uuid: userData.extraData?.identity,
      xuid: userData.extraData?.xuid
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
      fs.writeFile(`packetdump_${this.connection.address}_${Date.now()}.bin`, packet)
      return
    }

    this.inLog?.(des.data.name, serialize(des.data.params).slice(0, 200))

    switch (des.data.name) {
      case 'login':
        this.onLogin(des)
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
  }
}

module.exports = { Player }
