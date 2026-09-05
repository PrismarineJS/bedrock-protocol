const { EventEmitter } = require('events')
const { Client, Server, PacketPriority, PacketReliability } = require('./raknet/index');

class RakClient extends EventEmitter {
  constructor(options) {
    super()
    this.connected = false
    this.onConnected = () => { }
    this.onCloseConnection = () => { }
    this.onEncapsulated = () => { }

    this.raknet = new Client(options.host, options.port, { protocolVersion: 11 })

    this.raknet.on('encapsulated', (buffer) => {
      this.onEncapsulated(buffer)
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

  connect() {
    this.raknet.connect()
  }

  close() {
    this.connected = false
    this.raknet.close()
  }

  sendReliable(buffer, immediate) {
    if (this.connected) return this.raknet.send(buffer, immediate ? PacketPriority.IMMEDIATE_PRIORITY : PacketPriority.MEDIUM_PRIORITY, PacketReliability.RELIABLE_ORDERED, 0)
  }
}

class RakServer extends EventEmitter {
  constructor (options = {}, server) {
    super()
    this.onOpenConnection = () => { }
    this.onCloseConnection = () => { }
    this.onEncapsulated = () => { }
    this.raknet = new Server(options.host, options.port, {
      maxConnections: 2,
      protocolVersion: 11,
      message: server.getAdvertisement().toBuffer()
    })
    this.onClose = () => {}

    this.updateAdvertisement = () => {
      this.raknet.setOfflineMessage(server.getAdvertisement().toBuffer())
    }

    this.raknet.on('openConnection', (client) => {
      client.sendReliable = function (buffer) {
        return this.send(buffer, PacketPriority.IMMEDIATE_PRIORITY, PacketReliability.RELIABLE_ORDERED, 0)
      }

      this.onOpenConnection(client)
    })

    this.raknet.on('closeConnection', (client, id) => {
      this.onCloseConnection(client, id)
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

module.exports = { RakClient, RakServer }