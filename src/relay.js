// process.env.DEBUG = 'minecraft-protocol raknet'
const fs = require('fs')
const { Client } = require("./client")
const { Server } = require("./server")
const { Player } = require("./serverPlayer")
const debug = require('debug')('minecraft-protocol relay')

/** @typedef {{ hostname: string, port: number, auth: 'client' | 'server' | null, destination?: { hostname: string, port: number } }} Options  */

const debugging = true // Do re-encoding tests

class RelayPlayer extends Player {
  constructor(server, conn) {
    super(server, conn)
    this.server = server
    this.conn = conn

    this.startRelaying = false
    this.once('join', () => { // The client has joined our proxy
      this.flushDownQueue() // Send queued packets from the upstream backend
      this.startRelaying = true
    })
    this.downQ = []
    this.upQ = []
    this.upInLog = (...msg) => console.info('** Backend -> Proxy', ...msg)
    this.upOutLog = (...msg) => console.info('** Proxy -> Backend', ...msg)
    this.downInLog = (...msg) => console.info('** Client -> Proxy', ...msg)
    this.downOutLog = (...msg) => console.info('** Proxy -> Client', ...msg)

    if (!server.options.logging) {
      this.upInLog = () => { }
      this.upOutLog = () => { }
      this.downInLog = () => { }
      this.downOutLog = () => { }
    }

    // this.upOutLog = (...msg) => {
    //   if (msg.includes('player_auth_input')) {
    //     // stream.write(msg)
    //     console.info('INPUT', msg)
    //   }
    // }

    this.outLog = this.downOutLog
    this.inLog = this.downInLog
  }

  // Called when we get a packet from backend server (Backend -> PROXY -> Client)
  readUpstream(packet) {
    if (!this.startRelaying) {
      console.warn('The downstream client is not ready yet !!')
      this.downQ.push(packet)
      return
    }
    this.upInLog('Recv packet', packet)
    const des = this.server.deserializer.parsePacketBuffer(packet)
    const name = des.data.name
    const params = des.data.params
    this.upInLog('~ Bounce B->C', name, serialize(params).slice(0, 100))
    // this.upInLog('~ ', des.buffer)
    if (name == 'play_status' && params.status == 'login_success') return // We already sent this, this needs to be sent ASAP or client will disconnect

    if (debugging) { // some packet encode/decode testing stuff
      const rpacket = this.server.serializer.createPacketBuffer({ name, params })
      if (rpacket.toString('hex') !== packet.toString('hex')) {
        console.warn('New', rpacket.toString('hex'))
        console.warn('Old', packet.toString('hex'))
        console.log('Failed to re-encode', name, params)
        process.exit(1)
        throw Error('re-encoding fail for' + name + ' - ' + JSON.stringify(params))
      }
    }

    this.queue(name, params)
    // this.sendBuffer(packet)
  }

  // Send queued packets to the connected client
  flushDownQueue() {
    for (const packet of this.downQ) {
      const des = this.server.deserializer.parsePacketBuffer(packet)
      this.write(des.data.name, des.data.params)
    }
    this.downQ = []
  }

  // Send queued packets to the backend upstream server from the client
  flushUpQueue() {
    for (var e of this.upQ) { // Send the queue
      const des = this.server.deserializer.parsePacketBuffer(e)
      if (des.data.name == 'client_cache_status') { // Currently broken, force off the chunk cache
        this.upstream.write('client_cache_status', { enabled: false })
      } else {
        this.upstream.write(des.data.name, des.data.params)
      }
    }
    this.upQ = []
  }

  // Called when the server gets a packet from the downstream player (Client -> PROXY -> Backend)
  readPacket(packet) {
    if (this.startRelaying) { // The downstream client conn is established & we got a packet to send to upstream server 
      if (!this.upstream) { // Upstream is still connecting/handshaking
        this.downInLog('Got downstream connected packet but upstream is not connected yet, added to q', this.upQ.length)
        this.upQ.push(packet) // Put into a queue
        return
      }
      this.flushUpQueue() // Send queued packets
      this.downInLog('Recv packet', packet)
      const des = this.server.deserializer.parsePacketBuffer(packet)

      if (debugging) { // some packet encode/decode testing stuff
        const rpacket = this.server.serializer.createPacketBuffer(des.data)
        if (rpacket.toString('hex') !== packet.toString('hex')) {
          console.warn('New', rpacket.toString('hex'))
          console.warn('Old', packet.toString('hex'))
          console.log('Failed to re-encode', des.data)
          process.exit(1)
        }
      }

      switch (des.data.name) {
        case 'client_cache_status':
          this.upstream.queue('client_cache_status', { enabled: false })
          break
        default:
          // Emit the packet as-is back to the upstream server
          // this.upstream.queue(des.data.name, des.data.params)
          this.downInLog('Relaying', des.data)
          this.upstream.sendBuffer(packet)
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
  constructor(options) {
    super(options)
    this.RelayPlayer = options.relayPlayer || RelayPlayer
    this.forceSingle = true
    this.upstreams = new Map()
  }

  openUpstreamConnection(ds, clientAddr) {
    const client = new Client({
      hostname: this.options.destination.hostname,
      port: this.options.destination.port,
      encrypt: this.options.encrypt
    })
    client.outLog = ds.upOutLog
    client.inLog = ds.upInLog
    // console.log('Set upstream logs', client.outLog, client.inLog)
    client.once('join', () => { // Intercept once handshaking done
      ds.upstream = client
      ds.flushUpQueue()
      console.log('UPSTREAM HAS JOINED')
      client.readPacket = (packet) => ds.readUpstream(packet)
    })
    this.upstreams.set(clientAddr.hash, client)
  }

  closeUpstreamConnection(clientAddr) {
    const up = this.upstreams.get(clientAddr.hash)
    if (!up) throw Error(`unable to close non-existant connection ${clientAddr.hash}`)
    up.close()
    this.upstreams.delete(clientAddr.hash)
    debug('relay closed connection', clientAddr)
  }

  onOpenConnection = (conn) => {
    debug('new connection', conn)
    if (this.forceSingle && this.clientCount > 0) {
      debug('dropping connection as single client relay', conn)
      conn.close()
    } else {
      const player = new this.RelayPlayer(this, conn)
      console.debug('New connection from', conn.address)
      this.clients[conn.address] = player
      this.emit('connect', { client: player })
      this.openUpstreamConnection(player, conn.address)
    }
  }
}

function serialize(obj = {}, fmt) {
  return JSON.stringify(obj, (k, v) => typeof v == 'bigint' ? v.toString() : v, fmt)
}

function createRelay() {
  console.log('Creating relay')
  /**
   * Example to create a non-transparent proxy (or 'Relay') connection to destination server
   * In Relay we de-code and re-encode packets
   */
  const relay = new Relay({
    /* Hostname and port for clients to listen to */
    hostname: '0.0.0.0',
    port: 19130,
    /**
     * Who does the authentication
     * If set to `client`, all connecting clients will be sent a message with a link to authenticate
     * If set to `server`, the server will authenticate and only one client will be able to join
     * (Default) If set to `none`, no authentication will be done
     */
    auth: 'server',

    /**
     * Sets if packets will automatically be forwarded. If set to false, you must listen for on('packet')
     * events and
     */
    auto: true,

    /* Where to send upstream packets to */
    destination: {
      hostname: '127.0.0.1',
      port: 19132,
      // encryption: true
    }
  })

  relay.create()
}

createRelay()