const { Client } = require('./client')
const { Server } = require('./server')
const { Player } = require('./serverPlayer')
const debug = globalThis.isElectron ? console.debug : require('debug')('minecraft-protocol')

const debugging = true // Do re-encoding tests

class RelayPlayer extends Player {
  constructor (server, conn) {
    super(server, conn)

    this.startRelaying = false
    this.once('join', () => { // The client has joined our proxy
      this.flushDownQueue() // Send queued packets from the upstream backend
      this.startRelaying = true
    })
    this.downQ = []
    this.upQ = []
    this.upInLog = (...msg) => console.debug('* Backend -> Proxy', ...msg)
    this.upOutLog = (...msg) => console.debug('* Proxy -> Backend', ...msg)
    this.downInLog = (...msg) => console.debug('* Client -> Proxy', ...msg)
    this.downOutLog = (...msg) => console.debug('* Proxy -> Client', ...msg)

    if (!server.options.logging) {
      this.upInLog = () => { }
      this.upOutLog = () => { }
      this.downInLog = () => { }
      this.downOutLog = () => { }
    }

    this.outLog = this.downOutLog
    this.inLog = this.downInLog
    this.chunkSendCache = []
    this.respawnPacket = []
  }

  // Called when we get a packet from backend server (Backend -> PROXY -> Client)
  readUpstream (packet) {
    if (!this.startRelaying) {
      this.downQ.push(packet)
      return
    }
    this.upInLog('->', packet)
    const des = this.server.deserializer.parsePacketBuffer(packet)
    const name = des.data.name
    const params = des.data.params
    if (name === 'play_status' && params.status === 'login_success') return // We already sent this, this needs to be sent ASAP or client will disconnect

    if (debugging) { // some packet encode/decode testing stuff
      this.server.deserializer.verify(des, this.server.serializer)
    }

    this.emit('clientbound', des.data)

    // If we're sending a chunk, but player isn't yet initialized, wait until it is.
    // This is wrong and should not be an issue to send chunks before the client
    // is in the world; need to investigate further, but for now it's fine.
    if (this.status !== 3) {
      if (name === 'level_chunk') {
        this.chunkSendCache.push([name, params])
        return
      }
      if (name === 'respawn') this.respawnPacket.push([name, params])
    } else if (this.status === 3 && this.chunkSendCache.length) {
      for (const chunk of this.chunkSendCache) {
        this.queue(...chunk)
      }
      for (const rp of this.respawnPacket) {
        this.queue(...rp)
      }
      this.chunkSendCache = []
      this.respawnPacket = []
    }
    this.queue(name, params)
  }

  // Send queued packets to the connected client
  flushDownQueue () {
    for (const packet of this.downQ) {
      const des = this.server.deserializer.parsePacketBuffer(packet)
      this.write(des.data.name, des.data.params)
    }
    this.downQ = []
  }

  // Send queued packets to the backend upstream server from the client
  flushUpQueue () {
    for (const e of this.upQ) { // Send the queue
      const des = this.server.deserializer.parsePacketBuffer(e)
      if (des.data.name === 'client_cache_status') { // Currently broken, force off the chunk cache
        this.upstream.write('client_cache_status', { enabled: false })
      } else {
        this.upstream.write(des.data.name, des.data.params)
      }
    }
    this.upQ = []
  }

  // Called when the server gets a packet from the downstream player (Client -> PROXY -> Backend)
  readPacket (packet) {
    // The downstream client conn is established & we got a packet to send to upstream server
    if (this.startRelaying) {
      // Upstream is still connecting/handshaking
      if (!this.upstream) {
        this.downInLog('Got downstream connected packet but upstream is not connected yet, added to q', this.upQ.length)
        this.upQ.push(packet) // Put into a queue
        return
      }

      // Send queued packets
      this.flushUpQueue()
      this.downInLog('recv', packet)

      // TODO: If we fail to parse a packet, proxy it raw and log an error
      const des = this.server.deserializer.parsePacketBuffer(packet)

      if (debugging) { // some packet encode/decode testing stuff
        this.server.deserializer.verify(des, this.server.serializer)
      }

      this.emit('serverbound', des.data)

      switch (des.data.name) {
        case 'client_cache_status':
          // Force the chunk cache off.
          this.upstream.queue('client_cache_status', { enabled: false })
          break
        case 'set_local_player_as_initialized':
          this.status = 3
          break
        default:
          // Emit the packet as-is back to the upstream server
          this.downInLog('Relaying', des.data)
          this.upstream.queue(des.data.name, des.data.params)
      }
    } else {
      super.readPacket(packet)
    }
  }
}

class Relay extends Server {
  /**
   * Creates a new non-transparent proxy connection to a destination server
   * @param {Options} options
   */
  constructor (options) {
    super(options)
    this.RelayPlayer = options.relayPlayer || RelayPlayer
    this.forceSingle = true
    this.upstreams = new Map()
    this.conLog = debug
  }

  openUpstreamConnection (ds, clientAddr) {
    const client = new Client({
      offline: this.options.offline,
      username: this.options.offline ? ds.profile.name : null,
      version: this.options.version,
      host: this.options.destination.host,
      port: this.options.destination.port,
      autoInitPlayer: false
    })
    // Set the login payload unless `noLoginForward` option
    if (!client.noLoginForward) client.skinData = ds.skinData
    client.connect()
    this.conLog('Connecting to', this.options.destination.host, this.options.destination.port)
    client.outLog = ds.upOutLog
    client.inLog = ds.upInLog
    client.once('join', () => { // Intercept once handshaking done
      // Tell the server to disable chunk cache for this connection as a client.
      // Wait a bit for the server to ack and process, the continue with proxying
      // otherwise the player can get stuck in an empty world.
      client.write('client_cache_status', { enabled: false })
      ds.upstream = client
      ds.flushUpQueue()
      this.conLog('Connected to upstream server')
      client.readPacket = (packet) => ds.readUpstream(packet)

      this.emit('join', /* client connected to proxy */ ds, /* backend server */ client)
    })
    this.upstreams.set(clientAddr.hash, client)
  }

  closeUpstreamConnection (clientAddr) {
    const up = this.upstreams.get(clientAddr.hash)
    if (!up) throw Error(`unable to close non-open connection ${clientAddr.hash}`)
    up.close()
    this.upstreams.delete(clientAddr.hash)
    this.conLog('closed upstream connection', clientAddr)
  }

  onOpenConnection = (conn) => {
    if (this.forceSingle && this.clientCount > 0) {
      this.conLog('dropping connection as single client relay', conn)
      conn.close()
    } else {
      const player = new this.RelayPlayer(this, conn)
      this.conLog('New connection from', conn.address)
      this.clients[conn.address] = player
      this.emit('connect', player)
      player.on('login', () => {
        this.openUpstreamConnection(player, conn.address)
      })
    }
  }

  close (...a) {
    for (const [, v] of this.upstreams) {
      v.close(...a)
    }
    super.close(...a)
  }
}

// Too many things called 'Proxy' ;)
module.exports = { Relay }
