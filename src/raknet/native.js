const { EventEmitter } = require('events')
const { waitFor } = require('../datatypes/util')

module.exports = ({ Client, Server, PacketPriority, PacketReliability, RakTimeout }) => {
  class RakNativeClient extends EventEmitter {
    constructor (options, client) {
      super()
      this.connected = false
      this.onConnected = () => { }
      this.onCloseConnection = () => { }
      this.onEncapsulated = () => { }

      const protocolVersion = client?.versionGreaterThanOrEqualTo('1.19.30') ? 11 : 10
      this.raknet = new Client(options.host, options.port, { protocolVersion })
      this.raknet.on('encapsulated', ({ buffer, address }) => {
        if (this.connected) { // Discard packets that are queued to be sent to us after close
          this.onEncapsulated(buffer, address)
        }
      })

      this.raknet.on('connect', () => {
        this.connected = true
        this.onConnected()
      })

      this.raknet.on('disconnect', ({ reason }) => {
        this.connected = false
        this.onCloseConnection(reason)
      })
    }

    async ping (timeout = 1000) {
      this.raknet.ping()
      return waitFor((done) => {
        this.raknet.on('pong', (ret) => {
          done(ret.extra?.toString() ?? '')
        })
      }, timeout, () => {
        if ('REPLIT_ENVIRONMENT' in process.env) {
          console.warn('A Replit environment was detected. Replit may not support the necessary outbound UDP connections required to connect to a Minecraft server. Please see https://github.com/PrismarineJS/bedrock-protocol/blob/master/docs/FAQ.md for more information.')
        }
        throw new RakTimeout('Ping timed out')
      })
    }

    connect () {
      this.raknet.connect()
    }

    close () {
      this.connected = false
      setTimeout(() => {
        this.raknet.close()
      }, 40)
    }

    sendReliable (buffer, immediate) {
      if (!this.connected) return
      const priority = immediate ? PacketPriority.IMMEDIATE_PRIORITY : PacketPriority.MEDIUM_PRIORITY
      return this.raknet.send(buffer, priority, PacketReliability.RELIABLE_ORDERED, 0)
    }
  }

  class RakNativeServer extends EventEmitter {
    constructor (options = {}, server) {
      super()
      this.onOpenConnection = () => { }
      this.onCloseConnection = () => { }
      this.onEncapsulated = () => { }
      this.raknet = new Server(options.host, options.port, {
        maxConnections: options.maxPlayers || 3,
        protocolVersion: server.versionLessThan('1.19.30') ? 10 : 11,
        message: server.getAdvertisement().toBuffer()
      })
      this.onClose = () => {}

      this.updateAdvertisement = () => {
        this.raknet.setOfflineMessage(server.getAdvertisement().toBuffer())
      }

      this.raknet.on('openConnection', (client) => {
        client.sendReliable = function (buffer, immediate) {
          const priority = immediate ? PacketPriority.IMMEDIATE_PRIORITY : PacketPriority.MEDIUM_PRIORITY
          return this.send(buffer, priority, PacketReliability.RELIABLE_ORDERED, 0)
        }
        this.onOpenConnection(client)
      })

      this.raknet.on('closeConnection', (client) => {
        this.onCloseConnection(client)
      })

      this.raknet.on('encapsulated', ({ buffer, address }) => {
        this.onEncapsulated(buffer, address)
      })

      this.raknet.on('close', (reason) => this.onClose(reason))
    }

    listen () {
      this.raknet.listen()
    }

    close () {
      this.raknet.close()
    }
  }

  return { RakServer: RakNativeServer, RakClient: RakNativeClient }
}
