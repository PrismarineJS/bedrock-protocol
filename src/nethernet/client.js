const dgram = require('dgram')
const { write } = require('sdp-transform')
const { EventEmitter } = require('events')
const { RTCIceCandidate, RTCPeerConnection } = require('werift')

const { Connection } = require('./connection')
const { getRandomUint64 } = require('../datatypes/util')
const { SignalType, SignalStructure } = require('./signalling')

const { getBroadcastAddress } = require('./net')
const { PACKET_TYPE } = require('./discovery/packets/Packet')
const { RequestPacket } = require('./discovery/packets/RequestPacket')
const { MessagePacket } = require('./discovery/packets/MessagePacket')
const { ResponsePacket } = require('./discovery/packets/ResponsePacket')
const { decrypt, encrypt, calculateChecksum } = require('./discovery/crypto')

const PORT = 7551
const BROADCAST_ADDRESS = getBroadcastAddress()

class Client extends EventEmitter {
  constructor (options = {}) {
    super()

    this.options = options

    this.networkId = getRandomUint64()

    this.connectionId = getRandomUint64()

    this.targetNetworkId = options.networkId

    this.socket = dgram.createSocket('udp4')

    this.socket.on('message', (buffer, rinfo) => {
      this.processPacket(buffer, rinfo)
    })

    this.responses = new Map()

    this.addresses = new Map()

    this.credentials = []

    this.signalHandler = this.sendDiscoveryMessage

    this.pingInterval = setInterval(() => {
      this.sendDiscoveryRequest()
    }, 2000)
  }

  async handleCandidate (signal) {
    await this.rtcConnection.addIceCandidate(new RTCIceCandidate({ candidate: signal.data }))
  }

  async handleAnswer (signal) {
    await this.rtcConnection.setRemoteDescription({ type: 'answer', sdp: signal.data })
  }

  async createOffer () {
    this.rtcConnection = new RTCPeerConnection({
      iceServers: this.credentials
    })

    this.connection = new Connection(this, this.connectionId, this.rtcConnection)

    const candidates = []

    this.rtcConnection.onicecandidate = (e) => {
      if (e.candidate) {
        candidates.push(e.candidate.candidate)
      }
    }

    this.connection.setChannels(
      this.rtcConnection.createDataChannel('ReliableDataChannel'),
      this.rtcConnection.createDataChannel('UnreliableDataChannel')
    )

    this.rtcConnection.onconnectionstatechange = () => {
      const state = this.rtcConnection.connectionState
      if (state === 'connected') this.emit('connected', this.connection)
      if (state === 'disconnected') this.emit('closeConnection', this.connectionId, 'disconnected')
    }

    await this.rtcConnection.createOffer()

    const ice = this.rtcConnection.iceTransports[0]

    const dtls = this.rtcConnection.dtlsTransports[0]

    if (!ice || !dtls) {
      throw new Error('Failed to create transports')
    }

    const iceParams = ice.iceGather.localParameters
    const dtlsParams = dtls.localParameters

    if (dtlsParams.fingerprints.length === 0) {
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

    this.signalHandler(
      new SignalStructure(SignalType.ConnectRequest, this.connectionId, desc, this.targetNetworkId)
    )

    for (const candidate of candidates) {
      this.signalHandler(
        new SignalStructure(SignalType.CandidateAdd, this.connectionId, candidate, this.targetNetworkId)
      )
    }
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
        break
      case PACKET_TYPE.DISCOVERY_RESPONSE:
        this.handleResponse(new ResponsePacket(decryptedData).decode(), rinfo)
        break
      case PACKET_TYPE.DISCOVERY_MESSAGE:
        this.handleMessage(new MessagePacket(decryptedData).decode())
        break
      default:
        throw new Error('Unknown packet type')
    }
  }

  handleResponse (packet, rinfo) {
    this.addresses.set(packet.senderId, rinfo)
    this.responses.set(packet.senderId, packet.data)
    this.emit('discoveryResponse', packet)
  }

  handleMessage (packet) {
    if (packet.data === 'Ping') {
      return
    }

    const signal = SignalStructure.fromString(packet.data)

    signal.networkId = packet.senderId

    this.handleSignal(signal)
  }

  handleSignal (signal) {
    switch (signal.type) {
      case SignalType.ConnectResponse:
        this.handleAnswer(signal)
        break
      case SignalType.CandidateAdd:
        this.handleCandidate(signal)
        break
    }
  }

  sendDiscoveryRequest () {
    const requestPacket = new RequestPacket()

    requestPacket.senderId = this.networkId

    requestPacket.encode()

    const buf = requestPacket.getBuffer()

    const packetToSend = Buffer.concat([calculateChecksum(buf), encrypt(buf)])

    this.socket.send(packetToSend, PORT, BROADCAST_ADDRESS)
  }

  sendDiscoveryMessage (signal) {
    const rinfo = this.addresses.get(signal.networkId)

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
    this.running = true

    await this.ping()

    await this.createOffer()
  }

  async ping () {
    this.running = true

    return new Promise((resolve, reject) => {
      this.on('discoveryResponse', (packet) => {
        if (packet.senderId === this.targetNetworkId) {
          resolve(packet.data)
        }
      })
    })
  }

  close (reason) {
    if (!this.running) return
    clearInterval(this.pingInterval)
    this.connection?.close()
    setTimeout(() => this.socket.close(), 100)
    this.connection = null
    this.running = false
    this.emit('disconnect', reason)
    this.removeAllListeners()
  }
}

module.exports = { Client }
