const dgram = require('node:dgram')
const { write } = require('sdp-transform')
const { EventEmitter } = require('node:events')
const { RTCIceCandidate, RTCPeerConnection } = require('werift')

const { Connection } = require('./connection')
const { SignalType, SignalStructure } = require('./signalling')

const { getBroadcastAddress } = require('./net')
const { PACKET_TYPE } = require('./discovery/packets/Packet')
const { RequestPacket } = require('./discovery/packets/RequestPacket')
const { MessagePacket } = require('./discovery/packets/MessagePacket')
const { ResponsePacket } = require('./discovery/packets/ResponsePacket')
const { decrypt, encrypt, calculateChecksum } = require('./discovery/crypto')

const { getRandomUint64 } = require('./util')

const debug = require('debug')('minecraft-protocol')

const PORT = 7551
const BROADCAST_ADDRESS = getBroadcastAddress()

class Client extends EventEmitter {
  constructor (networkId) {
    super()

    this.serverNetworkId = networkId

    this.networkId = getRandomUint64()
    debug('C: Generated networkId:', this.networkId)

    this.connectionId = getRandomUint64()
    debug('C: Generated connectionId:', this.connectionId)

    this.socket = dgram.createSocket('udp4')

    this.socket.on('message', (buffer, rinfo) => {
      debug('C: Received message from', rinfo.address, ':', rinfo.port)
      this.processPacket(buffer, rinfo)
    })

    this.responses = new Map()
    this.addresses = new Map()

    this.credentials = []

    this.signalHandler = this.sendDiscoveryMessage

    this.sendDiscoveryRequest()
    debug('C: Sent initial discovery request')

    this.pingInterval = setInterval(() => {
      debug('C: Sending periodic discovery request')
      this.sendDiscoveryRequest()
    }, 2000)
  }

  async handleCandidate (signal) {
    debug('C: Handling ICE candidate signal:', signal)
    await this.rtcConnection.addIceCandidate(new RTCIceCandidate({ candidate: signal.data }))
  }

  async handleAnswer (signal) {
    debug('C: Handling answer signal:', signal)
    await this.rtcConnection.setRemoteDescription({ type: 'answer', sdp: signal.data })
  }

  async createOffer () {
    debug('C: Creating RTC offer')
    this.rtcConnection = new RTCPeerConnection({
      iceServers: this.credentials
    })

    this.connection = new Connection(this, this.connectionId, this.rtcConnection)

    const candidates = []

    this.rtcConnection.onicecandidate = (e) => {
      if (e.candidate) {
        debug('C: Collected ICE candidate:', e.candidate.candidate)
        candidates.push(e.candidate.candidate)
      }
    }

    this.connection.setChannels(
      this.rtcConnection.createDataChannel('ReliableDataChannel'),
      this.rtcConnection.createDataChannel('UnreliableDataChannel')
    )

    this.connection.reliable.onopen = () => { this.emit('connected', this.connection) }

    this.rtcConnection.onconnectionstatechange = () => {
      const state = this.rtcConnection.connectionState
      debug('C: Connection state changed:', state)
      if (state === 'disconnected') this.emit('disconnect', this.connectionId, 'disconnected')
    }

    await this.rtcConnection.createOffer()

    const ice = this.rtcConnection.iceTransports[0]
    const dtls = this.rtcConnection.dtlsTransports[0]

    if (!ice || !dtls) {
      debug('C: Failed to create ICE or DTLS transports')
      throw new Error('Failed to create transports')
    }

    const iceParams = ice.iceGather.localParameters
    const dtlsParams = dtls.localParameters

    if (dtlsParams.fingerprints.length === 0) {
      debug('C: No DTLS fingerprints available')
      throw new Error('local DTLS parameters has no fingerprints')
    }

    const desc = write({
      version: 0,
      origin: {
        username: '-',
        sessionId: getRandomUint64().toString(),
        sessionVersion: 2,
        netType: 'IN',
        ipVer: 4,
        address: '127.0.0.1'
      },
      name: '-',
      timing: { start: 0, stop: 0 },
      groups: [{ type: 'BUNDLE', mids: '0' }],
      extmapAllowMixed: 'extmap-allow-mixed',
      msidSemantic: { semantic: '', token: 'WMS' },
      media: [
        {
          rtp: [],
          fmtp: [],
          type: 'application',
          port: 9,
          protocol: 'UDP/DTLS/SCTP',
          payloads: 'webrtc-datachannel',
          connection: { ip: '0.0.0.0', version: 4 },
          iceUfrag: iceParams.usernameFragment,
          icePwd: iceParams.password,
          iceOptions: 'trickle',
          fingerprint: { type: dtlsParams.fingerprints[0].algorithm, hash: dtlsParams.fingerprints[0].value },
          setup: 'active',
          mid: '0',
          sctpPort: 5000,
          maxMessageSize: 65536
        }
      ]
    })

    await this.rtcConnection.setLocalDescription({ type: 'offer', sdp: desc })

    debug('C: Local SDP set:', desc)

    this.signalHandler(
      new SignalStructure(SignalType.ConnectRequest, this.connectionId, desc, this.serverNetworkId)
    )

    for (const candidate of candidates) {
      debug('C: Sending ICE candidate signal:', candidate)
      this.signalHandler(
        new SignalStructure(SignalType.CandidateAdd, this.connectionId, candidate, this.serverNetworkId)
      )
    }
  }

  processPacket (buffer, rinfo) {
    debug('C: Processing packet from', rinfo.address, ':', rinfo.port)
    if (buffer.length < 32) {
      debug('C: Received packet is too short')
      throw new Error('Packet is too short')
    }

    const decryptedData = decrypt(buffer.slice(32))
    const checksum = calculateChecksum(decryptedData)

    if (Buffer.compare(buffer.slice(0, 32), checksum) !== 0) {
      debug('C: Checksum mismatch for packet from', rinfo.address)
      throw new Error('Checksum mismatch')
    }

    const packetType = decryptedData.readUInt16LE(2)
    debug('C: Packet type:', packetType)

    switch (packetType) {
      case PACKET_TYPE.DISCOVERY_REQUEST:
        debug('C: Received DISCOVERY_REQUEST packet')
        break
      case PACKET_TYPE.DISCOVERY_RESPONSE:
        debug('C: Received DISCOVERY_RESPONSE packet')
        this.handleResponse(new ResponsePacket(decryptedData).decode(), rinfo)
        break
      case PACKET_TYPE.DISCOVERY_MESSAGE:
        debug('C: Received DISCOVERY_MESSAGE packet')
        this.handleMessage(new MessagePacket(decryptedData).decode())
        break
      default:
        debug('C: Unknown packet type:', packetType)
        throw new Error('Unknown packet type')
    }
  }

  handleResponse (packet, rinfo) {
    debug('C: Handling discovery response from', rinfo.address, 'with data:', packet)
    this.addresses.set(packet.senderId, rinfo)
    this.responses.set(packet.senderId, packet.data)
    this.emit('pong', packet)
  }

  handleMessage (packet) {
    debug('C: Handling discovery message:', packet)
    if (packet.data === 'Ping') {
      debug('C: Ignoring ping message')
      return
    }

    const signal = SignalStructure.fromString(packet.data)

    signal.networkId = packet.senderId

    debug('C: Processing signal:', signal)
    this.handleSignal(signal)
  }

  handleSignal (signal) {
    debug('C: Handling signal of type:', signal.type)
    switch (signal.type) {
      case SignalType.ConnectResponse:
        debug('C: Handling ConnectResponse signal')
        this.handleAnswer(signal)
        break
      case SignalType.CandidateAdd:
        debug('C: Handling CandidateAdd signal')
        this.handleCandidate(signal)
        break
    }
  }

  sendDiscoveryRequest () {
    debug('C: Sending discovery request')
    const requestPacket = new RequestPacket()

    requestPacket.senderId = this.networkId

    requestPacket.encode()

    const buf = requestPacket.getBuffer()

    const packetToSend = Buffer.concat([calculateChecksum(buf), encrypt(buf)])

    this.socket.send(packetToSend, PORT, BROADCAST_ADDRESS)
  }

  sendDiscoveryMessage (signal) {
    debug('C: Sending discovery message for signal:', signal)
    const rinfo = this.addresses.get(signal.networkId)

    if (!rinfo) {
      debug('C: No address found for networkId:', signal.networkId)
      return
    }

    const messagePacket = new MessagePacket()

    messagePacket.senderId = this.networkId
    messagePacket.recipientId = BigInt(signal.networkId)
    messagePacket.data = signal.toString()
    messagePacket.encode()

    const buf = messagePacket.getBuffer()

    const packetToSend = Buffer.concat([calculateChecksum(buf), encrypt(buf)])

    this.socket.send(packetToSend, rinfo.port, rinfo.address)
  }

  async connect () {
    debug('C: Initiating connection')
    this.running = true

    await this.createOffer()
  }

  send (buffer) {
    this.connection.send(buffer)
  }

  ping () {
    debug('C: Sending ping')

    this.sendDiscoveryRequest()
  }

  close (reason) {
    debug('C: Closing client with reason:', reason)
    if (!this.running) return
    clearInterval(this.pingInterval)
    this.connection?.close()
    setTimeout(() => this.socket.close(), 100)
    this.connection = null
    this.running = false
    this.removeAllListeners()
  }
}

module.exports = { Client }
