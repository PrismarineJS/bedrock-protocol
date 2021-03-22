const { ClientStatus, Connection } = require('./connection')
const fs = require('fs')
const Options = require('./options')

const { Encrypt } = require('./auth/encryption')
const Login = require('./auth/login')
const LoginVerify = require('./auth/loginVerify')

class Player extends Connection {
  constructor (server, connection) {
    super()
    this.server = server
    this.serializer = server.serializer
    this.deserializer = server.deserializer
    this.connection = connection
    this.options = server.options

    Encrypt(this, server, server.options)
    Login(this, server, server.options)
    LoginVerify(this, server, server.options)

    this.startQueue()
    this.status = ClientStatus.Authenticating
    this.inLog = (...args) => console.info('S -> C', ...args)
    this.outLog = (...args) => console.info('C -> S', ...args)
  }

  getData () {
    return this.userData
  }

  onLogin (packet) {
    const body = packet.data
    // debug('Login body', body)
    this.emit('loggingIn', body)

    const clientVer = body.protocol_version
    if (this.server.options.protocolVersion) {
      if (this.server.options.protocolVersion < clientVer) {
        this.sendDisconnectStatus('failed_client')
        return
      }
    } else if (clientVer < Options.MIN_VERSION) {
      this.sendDisconnectStatus('failed_client')
      return
    }

    // Parse login data
    const authChain = JSON.parse(body.params.chain)
    const skinChain = body.params.client_data

    try {
      var { key, userData, chain } = this.decodeLoginJWT(authChain.chain, skinChain) // eslint-disable-line
    } catch (e) {
      console.error(e)
      // TODO: disconnect user
      throw new Error('Failed to verify user')
    }
    console.log('Verified user', 'got pub key', key, userData)

    this.emit('login', { user: userData.extraData }) // emit events for user
    this.emit('server.client_handshake', { key }) // internal so we start encryption

    this.userData = userData.extraData
    this.profile = {
      name: userData.extraData?.displayName,
      uuid: userData.extraData?.identity,
      xuid: userData.extraData?.xuid
    }
    this.version = clientVer
  }

  /**
   * Disconnects a client before it has joined
   * @param {string} playStatus
   */
  sendDisconnectStatus (playStatus) {
    this.write('play_status', { status: playStatus })
    this.close()
  }

  /**
   * Disconnects a client after it has joined
   */
  disconnect (reason, hide = false) {
    this.write('disconnect', {
      hide_disconnect_screen: hide,
      message: reason
    })
    this.close()
  }

  // After sending Server to Client Handshake, this handles the client's
  // Client to Server handshake response. This indicates successful encryption
  onHandshake () {
    // this.outLog('Sending login success!', this.status)
    // https://wiki.vg/Bedrock_Protocol#Play_Status
    this.write('play_status', { status: 'login_success' })
    this.status = ClientStatus.Initializing
    this.emit('join')
  }

  close () {
    this.q = []
    this.q2 = []
    clearInterval(this.loop)
    this.connection?.close()
    this.removeAllListeners()
  }

  readPacket (packet) {
    // console.log('packet', packet)
    try {
      var des = this.server.deserializer.parsePacketBuffer(packet) // eslint-disable-line
    } catch (e) {
      this.disconnect('Server error')
      console.warn('Packet parsing failed! Writing dump to ./packetdump.bin')
      fs.writeFileSync('packetdump.bin', packet)
      fs.writeFileSync('packetdump.txt', packet.toString('hex'))
      throw e
    }

    console.log('-> S', des)
    switch (des.data.name) {
      case 'login':
        console.log(des)
        this.onLogin(des)
        return
      case 'client_to_server_handshake':
        // Emit the 'join' event
        this.onHandshake()
        break
      case 'set_local_player_as_initialized':
        this.status = ClientStatus.Initialized
        // Emit the 'spawn' event
        this.emit('spawn')
        break
      default:
        console.log('ignoring, unhandled')
    }
    this.emit(des.data.name, des.data.params)
  }
}

module.exports = { Player, ClientStatus }
