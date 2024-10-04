const dgram = require('dgram')
const { EventEmitter } = require('events')
const { RTCIceCandidate, RTCPeerConnection } = require('werift')

const { Connection } = require('./connection')
const { SignalStructure, SignalType } = require('./signalling')

const { PACKET_TYPE } = require('./discovery/packets/packet')
const { MessagePacket } = require('./discovery/packets/MessagePacket')
const { ResponsePacket } = require('./discovery/packets/ResponsePacket')
const { decrypt, encrypt, calculateChecksum } = require('./discovery/crypto')

const debug = require('debug')('minecraft-protocol')

class Server extends EventEmitter {
  constructor (options = {}) {
    super()

    this.options = options

    this.networkId = options.networkId

    this.connections = new Map()
  }

  async handleCandidate (signal) {
    const conn = this.connections.get(signal.connectionId)

    if (conn) {
      await conn.rtcConnection.addIceCandidate(new RTCIceCandidate({ candidate: signal.data }))
    } else {
      debug('Received candidate for unknown connection', signal)
    }
  }

  async handleOffer (signal, respond, credentials = []) {
    const rtcConnection = new RTCPeerConnection({
      iceServers: credentials
    })

    const connection = new Connection(this, signal.connectionId, rtcConnection)

    this.connections.set(signal.connectionId, connection)

    rtcConnection.onicecandidate = (e) => {
      if (e.candidate) {
        respond(
          new SignalStructure(SignalType.CandidateAdd, signal.connectionId, e.candidate.candidate, signal.networkId)
        )
      }
    }

    rtcConnection.ondatachannel = ({ channel }) => {
      if (channel.label === 'ReliableDataChannel') connection.setChannels(channel)
      if (channel.label === 'UnreliableDataChannel') connection.setChannels(null, channel)
    }

    rtcConnection.onconnectionstatechange = () => {
      const state = rtcConnection.connectionState
      if (state === 'connected') this.emit('openConnection', connection)
      if (state === 'disconnected') this.emit('closeConnection', signal.connectionId, 'disconnected')
    }

    await rtcConnection.setRemoteDescription({ type: 'offer', sdp: signal.data })

    const answer = await rtcConnection.createAnswer()

    await rtcConnection.setLocalDescription(answer)

    respond(
      new SignalStructure(SignalType.ConnectResponse, signal.connectionId, answer.sdp, signal.networkId)
    )
  }

  processPacket (buffer, rinfo) {
    if (buffer.length < 32) {
      throw new Error('Packet is too short')
    }

    const decryptedData = decrypt(buffer.slice(32))

    const checksum = calculateChecksum(decryptedData)

    if (Buffer.compare(buffer.slice(0, 32), checksum) !== 0) {
      throw new Error('Checksum mismatch')
    }

    const packetType = decryptedData.readUInt16LE(2)

    switch (packetType) {
      case PACKET_TYPE.DISCOVERY_REQUEST:
        this.handleRequest(rinfo)
        break
      case PACKET_TYPE.DISCOVERY_RESPONSE:
        break
      case PACKET_TYPE.DISCOVERY_MESSAGE:
        this.handleMessage(new MessagePacket(decryptedData).decode(), rinfo)
        break
      default:
        throw new Error('Unknown packet type')
    }
  }

  setAdvertisement (buffer) {
    this.advertisement = buffer
  }

  handleRequest (rinfo) {
    const data = this.advertisement

    if (!data) {
      return new Error('Advertisement data not set yet')
    }

    const responsePacket = new ResponsePacket()

    responsePacket.senderId = this.networkId
    responsePacket.data = data

    responsePacket.encode()

    const buf = responsePacket.getBuffer()

    const packetToSend = Buffer.concat([calculateChecksum(buf), encrypt(buf)])

    this.socket.send(packetToSend, rinfo.port, rinfo.address)
  }

  handleMessage (packet, rinfo) {
    if (packet.data === 'Ping') {
      return
    }

    const respond = (signal) => {
      const messagePacket = new MessagePacket()

      messagePacket.senderId = this.networkId
      messagePacket.recipientId = signal.networkId
      messagePacket.data = signal.toString()
      messagePacket.encode()

      const buf = messagePacket.getBuffer()

      const packetToSend = Buffer.concat([calculateChecksum(buf), encrypt(buf)])

      this.socket.send(packetToSend, rinfo.port, rinfo.address)
    }

    const signal = SignalStructure.fromString(packet.data)

    signal.networkId = packet.senderId

    switch (signal.type) {
      case SignalType.ConnectRequest:
        this.handleOffer(signal, respond)
        break
      case SignalType.CandidateAdd:
        this.handleCandidate(signal)
        break
    }
  }

  async listen () {
    this.socket = dgram.createSocket('udp4')

    this.socket.on('message', (buffer, rinfo) => {
      this.processPacket(buffer, rinfo)
    })

    await new Promise((resolve, reject) => {
      const failFn = e => reject(e)
      this.socket.once('error', failFn)
      this.socket.bind(7551, () => {
        this.socket.removeListener('error', failFn)
        resolve(true)
      })
    })
  }

  close (reason) {
    for (const conn of this.connections.values()) {
      conn.close()
    }

    this.socket.close(() => {
      this.emit('close', reason)
      this.removeAllListeners()
    })
  }
}

module.exports = { Server }
