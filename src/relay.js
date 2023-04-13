const { Client } = require('./client')
const { Server } = require('./server')
const { Player } = require('./serverPlayer')
const { realmAuthenticate } = require('./client/auth')
const debug = globalThis.isElectron ? console.debug : require('debug')('minecraft-protocol')

const debugging = false // Do re-encoding tests

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
    this.sentStartGame = false
    this.respawnPacket = []
  }

  // Called when we get a packet from backend server (Backend -> PROXY -> Client)
  readUpstream (packet) {
    if (!this.startRelaying) {
      this.upInLog('Client not ready, queueing packet until join')
      this.downQ.push(packet)
      return
    }
    let des
    try {
      des = this.server.deserializer.parsePacketBuffer(packet)
    } catch (e) {
      this.server.deserializer.dumpFailedBuffer(packet, this.connection.address)
      console.error(this.connection.address, e)
      this.disconnect('Server packet parse error')
      return
    }
    const name = des.data.name
    const params = des.data.params
    this.upInLog('->', name, params)

    if (name === 'play_status' && params.status === 'login_success') return // Already sent this, this needs to be sent ASAP or client will disconnect

    if (debugging) { // some packet encode/decode testing stuff
      this.server.deserializer.verify(des, this.server.serializer)
    }

    this.emit('clientbound', des.data, des)

    if (!des.canceled) {
      if (name === 'start_game') {
        setTimeout(() => {
          this.sentStartGame = true
        }, 500)
      } else if (name === 'level_chunk' && !this.sentStartGame) {
        this.chunkSendCache.push(params)
        return
      }

      this.queue(name, params)
    }

    if (this.chunkSendCache.length > 0 && this.sentStartGame) {
      for (const entry of this.chunkSendCache) {
        this.queue('level_chunk', entry)
      }
      this.chunkSendCache = []
    }
  }

  // Send queued packets to the connected client
  flushDownQueue () {
    this.downOutLog('Flushing downstream queue')
    for (const packet of this.downQ) {
      const des = this.server.deserializer.parsePacketBuffer(packet)
      this.write(des.data.name, des.data.params)
    }
    this.downQ = []
  }

  // Send queued packets to the backend upstream server from the client
  flushUpQueue () {
    this.upOutLog('Flushing upstream queue')
    for (const e of this.upQ) { // Send the queue
      const des = this.server.deserializer.parsePacketBuffer(e)
      if (des.data.name === 'client_cache_status') {
        // Currently not working, force off the chunk cache
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
        const des = this.server.deserializer.parsePacketBuffer(packet)
        this.downInLog('Got downstream connected packet but upstream is not connected yet, added to q', des)
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

      this.emit('serverbound', des.data, des)
      if (des.canceled) return

      switch (des.data.name) {
        case 'client_cache_status':
          // Force the chunk cache off.
          this.upstream.queue('client_cache_status', { enabled: this.enableChunkCaching })
          break
        case 'set_local_player_as_initialized':
          this.status = 3
        // falls through
        default:
          // Emit the packet as-is back to the upstream server
          this.downInLog('Relaying', des.data)
          this.upstream.queue(des.data.name, des.data.params)
      }
    } else {
      super.readPacket(packet)
    }
  }

  close (reason) {
    this.upstream?.close(reason)
    super.close(reason)
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
    this.forceSingle = options.forceSingle
    this.upstreams = new Map()
    this.conLog = debug
    this.enableChunkCaching = options.enableChunkCaching
  }

  // Called after a new player joins our proxy. We first create a new Client to connect to
  // the remote server. Then we listen to some events and proxy them over. The queue and
  // flushing logic is more of an accessory to make sure the server or client recieves
  // a packet, no matter what state it's in. For example, if the client wants to send a
  // packet to the server but it's not connected, it will add to the queue and send as soon
  // as a connection with the server is established.
  async openUpstreamConnection (ds, clientAddr) {
    const options = {
      authTitle: this.options.authTitle,
      offline: this.options.destination.offline ?? this.options.offline,
      username: this.options.offline ? ds.profile.name : ds.profile.xuid,
      version: this.options.version,
      realms: this.options.destination.realms,
      host: this.options.destination.host,
      port: this.options.destination.port,
      onMsaCode: (code) => {
        if (this.options.onMsaCode) {
          this.options.onMsaCode(code, ds)
        } else {
          ds.disconnect("It's your first time joining. Please sign in and reconnect to join this server:\n\n" + code.message)
        }
      },
      profilesFolder: this.options.profilesFolder,
      backend: this.options.backend,
      autoInitPlayer: false
    }

    if (this.options.destination.realms) {
      await realmAuthenticate(options)
    }

    const client = new Client(options)
    // Set the login payload unless `noLoginForward` option
    if (!client.noLoginForward) client.options.skinData = ds.skinData
    client.ping().then(pongData => {
      client.connect()
    }).catch(err => {
      this.emit('error', err)
    })
    this.conLog('Connecting to', options.host, options.port)
    client.outLog = ds.upOutLog
    client.inLog = ds.upInLog
    client.once('join', () => {
      // Tell the server to disable chunk cache for this connection as a client.
      // Wait a bit for the server to ack and process, the continue with proxying
      // otherwise the player can get stuck in an empty world.
      client.write('client_cache_status', { enabled: this.enableChunkCaching })
      ds.upstream = client
      ds.flushUpQueue()
      this.conLog('Connected to upstream server')
      client.readPacket = (packet) => ds.readUpstream(packet)

      this.emit('join', /* client connected to proxy */ ds, /* backend server */ client)
    })
    client.on('error', (err) => {
      ds.disconnect('Server error: ' + err.message)
      debug(clientAddr, 'was disconnected because of error', err)
      this.upstreams.delete(clientAddr.hash)
    })
    client.on('close', (reason) => {
      ds.disconnect('Backend server closed connection')
      this.upstreams.delete(clientAddr.hash)
    })

    this.upstreams.set(clientAddr.hash, client)
  }

  // Close a connection to a remote backend server.
  closeUpstreamConnection (clientAddr) {
    const up = this.upstreams.get(clientAddr.hash)
    if (!up) throw Error(`unable to close non-open connection ${clientAddr.hash}`)
    up.close()
    this.upstreams.delete(clientAddr.hash)
    this.conLog('closed upstream connection', clientAddr)
  }

  // Called when a new player connects to our proxy server. Once the player has authenticated,
  // we can open an upstream connection to the backend server.
  onOpenConnection = (conn) => {
    if (this.forceSingle && this.clientCount > 0) {
      this.conLog('dropping connection as single client relay', conn)
      conn.close()
    } else {
      this.clientCount++
      const player = new this.RelayPlayer(this, conn)
      this.conLog('New connection from', conn.address)
      this.clients[conn.address] = player
      this.emit('connect', player)
      player.on('login', () => {
        this.openUpstreamConnection(player, conn.address)
      })
      player.on('close', (reason) => {
        this.conLog('player disconnected', conn.address, reason)
        this.clientCount--
        delete this.clients[conn.address]
      })
    }
  }

  // When our server is closed, make sure to kick all of the connected clients and run emitters.
  close (...a) {
    for (const [, v] of this.upstreams) {
      v.close(...a)
    }
    super.close(...a)
  }
}

// Too many things called 'Proxy' ;)
module.exports = { Relay }
