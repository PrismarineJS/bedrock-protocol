const { EventEmitter } = require('events')
const ConnWorker = require('./rakWorker')
const { waitFor } = require('./datatypes/util')
// TODO: better way to switch, via an option
try {
  var { Client, Server, PacketPriority, PacketReliability } = require('raknet-native') // eslint-disable-line
} catch (e) {
  var { Client, Server, EncapsulatedPacket, Reliability } = require('jsp-raknet') // eslint-disable-line
  console.debug('[raknet] native not found, using js', e)
}

class RakNativeClient extends EventEmitter {
  constructor (options) {
    super()
    this.connected = false
    this.onConnected = () => { }
    this.onCloseConnection = () => { }
    this.onEncapsulated = () => { }

    this.raknet = new Client(options.host, options.port, { protocolVersion: 10 })
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
    this.raknet = new Server(options.host, options.port, {
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
    this.options = options
    this.onConnected = () => { }
    this.onEncapsulated = () => { }
    if (options.useWorkers) {
      this.connect = this.workerConnect
      this.close = reason => this.worker?.postMessage({ type: 'close', reason })
      this.sendReliable = this.workerSendReliable
    } else {
      this.connect = this.plainConnect
      this.close = this.plainClose
      this.sendReliable = this.plainSendReliable
    }
  }

  workerConnect (host = this.options.host, port = this.options.port) {
    this.worker = ConnWorker.connect(host, port)

    this.worker.on('message', (evt) => {
      switch (evt.type) {
        case 'connected': {
          this.onConnected()
          break
        }
        case 'encapsulated': {
          const [ecapsulated, address] = evt.args
          this.onEncapsulated(ecapsulated, address.hash)
          break
        }
      }
    })
  }

  async plainConnect (host = this.options.host, port = this.options.port) {
    this.raknet = new Client(host, port)
    await this.raknet.connect()

    this.raknet.on('connecting', () => {
      console.log(`[client] connecting to ${host}/${port}`)
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

  plainClose (reason) {
    this.raknet.close(reason)
  }

  ping () {
    // TODO
  }
}

class RakJsServer extends EventEmitter {
  constructor (options = {}, server) {
    super()
    this.options = options
    this.server = server
    this.onOpenConnection = () => { }
    this.onCloseConnection = () => { }
    this.onEncapsulated = (packet, address) => server.onEncapsulated(packet.buffer, address)
    this.updateAdvertisement = () => {
      // TODO
    }
    if (options.useWorkers) {
      throw Error('nyi')
    } else {
      this.listen = this.plainListen
    }
  }

  async plainListen () {
    this.raknet = new Server(this.options.host, this.options.port, this.server.getAdvertisement())
    await this.raknet.listen(this.options.host, this.options.port)
    this.raknet.on('openConnection', (conn) => {
      conn.sendReliable = (buffer, immediate) => {
        const sendPacket = new EncapsulatedPacket()
        sendPacket.reliability = Reliability.ReliableOrdered
        sendPacket.buffer = buffer
        conn.addEncapsulatedToQueue(sendPacket, immediate ? 1 : 0)
      }
      this.onOpenConnection(conn)
    })
    this.raknet.on('closeConnection', this.onCloseConnection)
    this.raknet.on('encapsulated', this.onEncapsulated)
  }
}

module.exports = {
  RakClient: PacketPriority ? RakNativeClient : RakJsClient,
  RakServer: PacketPriority ? RakNativeServer : RakJsServer
}
