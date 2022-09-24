const { EventEmitter } = require('events')
const ConnWorker = require('./rakWorker')
const { waitFor } = require('./datatypes/util')

let Client, Server, PacketPriority, EncapsulatedPacket, PacketReliability, Reliability
class RakTimeout extends Error {};

module.exports = (backend) => {
  try {
    if (backend === 'jsp-raknet') {
      ({ Client, Server, EncapsulatedPacket, Reliability } = require('jsp-raknet'))
      return { RakServer: RakJsServer, RakClient: RakJsClient, RakTimeout }
    }
    // We need to explicitly name the require()s for bundlers
    if (backend === 'raknet-node') ({ Client, Server, PacketPriority, PacketReliability } = require('raknet-node'))
    if (backend === 'raknet-native') ({ Client, Server, PacketPriority, PacketReliability } = require('raknet-native'))
    else ({ Client, Server, PacketPriority, PacketReliability } = require(backend))
    return { RakServer: RakNativeServer, RakClient: RakNativeClient, RakTimeout }
  } catch (e) {
    ({ Client, Server, EncapsulatedPacket, Reliability } = require('jsp-raknet'))
    console.debug('[raknet] ' + backend + ' library not found, defaulting to jsp-raknet. Correct the "raknetBackend" option to avoid this error.', e)
  }
  return { RakServer: RakJsServer, RakClient: RakJsClient, RakTimeout }
}

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
        if (ret.extra) {
          done(ret.extra.toString())
        }
      })
    }, timeout, () => { throw new RakTimeout('Ping timed out') })
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

class RakJsClient extends EventEmitter {
  constructor (options = {}) {
    super()
    this.options = options
    this.onConnected = () => { }
    this.onCloseConnection = () => { }
    this.onEncapsulated = () => { }
    if (options.useWorkers) {
      this.connect = this.workerConnect
      this.close = reason => this.worker?.postMessage({ type: 'close', reason })
      this.sendReliable = this.workerSendReliable
    } else {
      this.connect = this.plainConnect
      this.close = reason => this.raknet.close(reason)
      this.sendReliable = this.plainSendReliable
    }
    this.pongCb = null
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
        case 'pong':
          this.pongCb?.(evt.args)
          break
        case 'disconnect':
          this.onCloseConnection()
          break
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
    this.raknet.on('encapsulated', (encapsulated, addr) => this.onEncapsulated(encapsulated, addr.hash))
    this.raknet.on('disconnect', (reason) => this.onCloseConnection(reason))
  }

  workerSendReliable (buffer, immediate) {
    this.worker.postMessage({ type: 'queueEncapsulated', packet: buffer, immediate })
  }

  plainSendReliable (buffer, immediate) {
    const sendPacket = new EncapsulatedPacket()
    sendPacket.reliability = Reliability.ReliableOrdered
    sendPacket.buffer = buffer
    this.raknet.connection.addEncapsulatedToQueue(sendPacket)
    if (immediate) this.raknet.connection.sendQueue()
  }

  async ping (timeout = 1000) {
    if (this.worker) {
      this.worker.postMessage({ type: 'ping' })
      return waitFor(res => {
        this.pongCb = data => res(data)
      }, timeout, () => { throw new RakTimeout('Ping timed out') })
    } else {
      if (!this.raknet) this.raknet = new Client(this.options.host, this.options.port)
      return waitFor(res => {
        this.raknet.ping(data => {
          this.raknet.close()
          res(data)
        })
      }, timeout, () => { throw new RakTimeout('Ping timed out') })
    }
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
    this.onClose = () => {}
    this.updateAdvertisement = () => {
      this.raknet.setPongAdvertisement(server.getAdvertisement())
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
    this.raknet.on('close', this.onClose)
  }

  close () {
    // Allow some time for the final packets to come in/out
    setTimeout(() => {
      this.raknet.close()
    }, 40)
  }
}
