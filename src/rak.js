const { EventEmitter } = require('events')
const Listener = require('jsp-raknet/listener')
const EncapsulatedPacket = require('jsp-raknet/protocol/encapsulated_packet')
const Reliability = require('jsp-raknet/protocol/reliability')
const RakClient = require('jsp-raknet/client')
const ConnWorker = require('./rakWorker')
const { waitFor } = require('./datatypes/util')
try {
  var { Client, Server, PacketPriority, PacketReliability } = require('raknet-native') // eslint-disable-line
} catch (e) {
  console.debug('[raknet] native not found, using js', e)
}

class RakNativeClient extends EventEmitter {
  constructor (options) {
    super()
    this.connected = false
    this.onConnected = () => { }
    this.onCloseConnection = () => { }
    this.onEncapsulated = () => { }

    this.raknet = new Client(options.hostname, options.port, { protocolVersion: 10 })
    this.raknet.on('encapsulated', ({ buffer, address }) => {
      this.onEncapsulated(buffer, address)
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
        if (ret.extra) {
          done(ret.extra.toString())
        }
      })
    }, timeout, () => { throw new Error('Ping timed out') })
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
    this.raknet = new Server(options.hostname, options.port, {
      maxConnections: options.maxPlayers || 3,
      protocolVersion: 10,
      message: server.getAdvertisement().toBuffer()
    })

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
  }

  listen () {
    this.raknet.listen()
  }

  close () {
    this.raknet.close()
  }
}

class RakJsClient extends EventEmitter {
  constructor (options = {}) {
    super()
    this.onConnected = () => { }
    this.onEncapsulated = () => { }
    if (options.useWorkers) {
      this.connect = this.workerConnect
      this.sendReliable = this.workerSendReliable
    } else {
      this.connect = this.plainConnect
      this.sendReliable = this.plainSendReliable
    }
  }

  workerConnect (hostname = this.options.hostname, port = this.options.port) {
    this.worker = ConnWorker.connect(hostname, port)

    this.worker.on('message', (evt) => {
      switch (evt.type) {
        case 'connected': {
          this.onConnected()
          break
        }
        case 'encapsulated': {
          const [ecapsulated, address] = evt.args
          this.onEncapsulated(ecapsulated.buffer, address.hash)
          break
        }
      }
    })
  }

  async plainConnect (hostname = this.options.hostname, port = this.options.port) {
    this.raknet = new RakClient(hostname, port)
    await this.raknet.connect()

    this.raknet.on('connecting', () => {
      console.log(`[client] connecting to ${hostname}/${port}`)
    })

    this.raknet.on('connected', this.onConnected)
    this.raknet.on('encapsulated', (encapsulated, addr) => this.onEncapsulated(encapsulated.buffer, addr.hash))
  }

  workerSendReliable (buffer, immediate) {
    this.worker.postMessage({ type: 'queueEncapsulated', packet: buffer, immediate })
  }

  plainSendReliable (buffer, immediate) {
    const sendPacket = new EncapsulatedPacket()
    sendPacket.reliability = Reliability.ReliableOrdered
    sendPacket.buffer = buffer
    this.connection.addEncapsulatedToQueue(sendPacket)
    if (immediate) this.connection.sendQueue()
  }
}

class RakJsServer extends EventEmitter {
  constructor (options = {}) {
    super()
    this.options = options
    this.onOpenConnection = () => { }
    this.onCloseConnection = () => { }
    this.onEncapsulated = () => { }

    if (options.useWorkers) {
      throw Error('nyi')
    } else {
      this.listen = this.plainListen
    }
  }

  async plainListen () {
    this.raknet = new Listener()
    await this.raknet.listen(this.options.hostname, this.options.port)
    this.raknet.on('openConnection', (conn) => {
      conn.sendReliable = function (buffer, immediate) {
        const sendPacket = new EncapsulatedPacket()
        sendPacket.reliability = Reliability.ReliableOrdered
        sendPacket.buffer = buffer
        this.connection.addEncapsulatedToQueue(sendPacket)
        if (immediate) this.raknet.sendQueue()
      }
      this.onOpenConnection(conn)
    })
    this.raknet.on('closeConnection', this.onCloseConnection)
    this.raknet.on('encapsulated', this.onEncapsulated)
  }
}

module.exports = {
  RakClient: Client ? RakNativeClient : RakJsClient,
  RakServer: Server ? RakNativeServer : RakJsServer
}
