const dgram = require('node:dgram')
const { EventEmitter } = require('node:events')
const { RTCIceCandidate, RTCPeerConnection } = require('werift')

const { Connection } = require('./connection')
const { SignalStructure, SignalType } = require('./signalling')

const { PACKET_TYPE } = require('./discovery/packets/Packet')
const { MessagePacket } = require('./discovery/packets/MessagePacket')
const { ResponsePacket } = require('./discovery/packets/ResponsePacket')
const { decrypt, encrypt, calculateChecksum } = require('./discovery/crypto')

const { getRandomUint64 } = require('./util')

const debug = require('debug')('minecraft-protocol')

class Server extends EventEmitter {
  constructor (options = {}) {
    super()

    this.options = options

    this.networkId = options.networkId ?? getRandomUint64()

    this.connections = new Map()

    debug('S: Server initialised with networkId: %s', this.networkId)
  }

  async handleCandidate (signal) {
    const conn = this.connections.get(signal.connectionId)

    if (conn) {
      debug('S: Adding ICE candidate for connectionId: %s', signal.connectionId)
      await conn.rtcConnection.addIceCandidate(new RTCIceCandidate({ candidate: signal.data }))
    } else {
      debug('S: Received candidate for unknown connection', signal)
    }
  }

  async handleOffer (signal, respond, credentials = []) {
    debug('S: Handling offer for connectionId: %s', signal.connectionId)
    const rtcConnection = new RTCPeerConnection({
      iceServers: credentials
    })

    const connection = new Connection(this, signal.connectionId, rtcConnection)

    this.connections.set(signal.connectionId, connection)

    rtcConnection.onicecandidate = (e) => {
      if (e.candidate) {
        debug('S: ICE candidate generated for connectionId: %s', signal.connectionId)
        respond(
          new SignalStructure(SignalType.CandidateAdd, signal.connectionId, e.candidate.candidate, signal.networkId)
        )
      }
    }

    rtcConnection.ondatachannel = ({ channel }) => {
      debug('S: Data channel established with label: %s', channel.label)
      if (channel.label === 'ReliableDataChannel') connection.setChannels(channel)
      if (channel.label === 'UnreliableDataChannel') connection.setChannels(null, channel)
    }

    rtcConnection.onconnectionstatechange = () => {
      const state = rtcConnection.connectionState
      debug('S: Connection state changed for connectionId: %s, state: %s', signal.connectionId, state)
      if (state === 'connected') this.emit('openConnection', connection)
      if (state === 'disconnected') this.emit('closeConnection', signal.connectionId, 'disconnected')
    }

    await rtcConnection.setRemoteDescription({ type: 'offer', sdp: signal.data })
    debug('S: Remote description set for connectionId: %s', signal.connectionId)

    const answer = await rtcConnection.createAnswer()
    await rtcConnection.setLocalDescription(answer)
    debug('S: Local description set (answer) for connectionId: %s', signal.connectionId)

    respond(
      new SignalStructure(SignalType.ConnectResponse, signal.connectionId, answer.sdp, signal.networkId)
    )
  }

  processPacket (buffer, rinfo) {
    debug('S: Processing packet from %s:%s', rinfo.address, rinfo.port)
    if (buffer.length < 32) {
      debug('S: Packet is too short')
      throw new Error('Packet is too short')
    }

    const decryptedData = decrypt(buffer.slice(32))

    const checksum = calculateChecksum(decryptedData)

    if (Buffer.compare(buffer.slice(0, 32), checksum) !== 0) {
      debug('S: Checksum mismatch')
      throw new Error('Checksum mismatch')
    }

    const packetType = decryptedData.readUInt16LE(2)

    debug('S: Packet type: %s', packetType)
    switch (packetType) {
      case PACKET_TYPE.DISCOVERY_REQUEST:
        debug('S: Handling discovery request')
        this.handleRequest(rinfo)
        break
      case PACKET_TYPE.DISCOVERY_RESPONSE:
        debug('S: Discovery response received (ignored)')
        break
      case PACKET_TYPE.DISCOVERY_MESSAGE:
        debug('S: Handling discovery message')
        this.handleMessage(new MessagePacket(decryptedData).decode(), rinfo)
        break
      default:
        debug('S: Unknown packet type: %s', packetType)
        throw new Error('Unknown packet type')
    }
  }

  setAdvertisement (buffer) {
    debug('S: Setting advertisement data')
    this.advertisement = buffer
  }

  handleRequest (rinfo) {
    debug('S: Handling request from %s:%s', rinfo.address, rinfo.port)
    const data = this.advertisement

    if (!data) {
      debug('S: Advertisement data not set')
      return new Error('Advertisement data not set yet')
    }

    const responsePacket = new ResponsePacket()

    responsePacket.senderId = this.networkId
    responsePacket.data = data

    responsePacket.encode()

    const buf = responsePacket.getBuffer()

    const packetToSend = Buffer.concat([calculateChecksum(buf), encrypt(buf)])

    this.socket.send(packetToSend, rinfo.port, rinfo.address)
    debug('S: Response sent to %s:%s', rinfo.address, rinfo.port)
  }

  handleMessage (packet, rinfo) {
    debug('S: Handling message from %s:%s', rinfo.address, rinfo.port)
    if (packet.data === 'Ping') {
      debug('S: Ping message received')
      return
    }

    const respond = (signal) => {
      debug('S: Responding with signal: %o', signal)
      const messagePacket = new MessagePacket()

      messagePacket.senderId = this.networkId
      messagePacket.recipientId = signal.networkId
      messagePacket.data = signal.toString()
      messagePacket.encode()

      const buf = messagePacket.getBuffer()

      const packetToSend = Buffer.concat([calculateChecksum(buf), encrypt(buf)])

      this.socket.send(packetToSend, rinfo.port, rinfo.address)
      debug('S: Signal response sent to %s:%s', rinfo.address, rinfo.port)
    }

    const signal = SignalStructure.fromString(packet.data)

    signal.networkId = packet.senderId

    switch (signal.type) {
      case SignalType.ConnectRequest:
        debug('S: Handling ConnectRequest signal')
        this.handleOffer(signal, respond)
        break
      case SignalType.CandidateAdd:
        debug('S: Handling CandidateAdd signal')
        this.handleCandidate(signal)
        break
    }
  }

  async listen () {
    debug('S: Starting server')
    this.socket = dgram.createSocket('udp4')

    this.socket.on('message', (buffer, rinfo) => {
      debug('S: Message received from %s:%s', rinfo.address, rinfo.port)
      this.processPacket(buffer, rinfo)
    })

    await new Promise((resolve, reject) => {
      const failFn = e => reject(e)
      this.socket.once('error', failFn)
      this.socket.bind(7551, () => {
        debug('S: Server is listening on port 7551')
        this.socket.removeListener('error', failFn)
        resolve(true)
      })
    })
  }

  send (buffer) {
    this.connection.send(buffer)
  }

  close (reason) {
    debug('S: Closing server: %s', reason)
    for (const conn of this.connections.values()) {
      conn.close()
    }

    this.socket.close(() => {
      debug('S: Server closed')
      this.emit('close', reason)
      this.removeAllListeners()
    })
  }
}

module.exports = { Server }
