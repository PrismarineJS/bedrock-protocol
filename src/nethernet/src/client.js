const dgram = require('node:dgram')
const crypto = require('node:crypto')
const { EventEmitter } = require('node:events')
const { Connection } = require('./connection')
const { PACKET_TYPE, createDeserializer, createSerializer } = require('./serializer')
const { SignalStructure, SignalType } = require('./signalling')
const { createPacketData, getRandomUint64, prepareSecurePacket, processSecurePacket } = require('./util')
const { RTCPeerConnection, RTCIceCandidate } = require('@roamhq/wrtc')
const { CompactSign, importPKCS8 } = require("jose");

const PORT = 7551
const BROADCAST_ADDRESS = '255.255.255.255'

class Client extends EventEmitter {
  constructor(networkId, broadcastAddress = BROADCAST_ADDRESS, token, identityPrivateKey) {
    super()

    this.serverNetworkId = networkId
    this.broadcastAddress = broadcastAddress
    this.token = token
    this.identityPrivateKey = identityPrivateKey
    this.networkId = getRandomUint64()
    this.connectionId = getRandomUint64()
    this.socket = dgram.createSocket('udp4')
    this.socket.on('message', (buffer, rinfo) => this.processPacket(buffer, rinfo))
    this.socket.bind(() => this.socket.setBroadcast(true))

    this.serializer = createSerializer()
    this.deserializer = createDeserializer()

    this.responses = new Map()
    this.addresses = new Map()
    this.credentials = []
    this.signalHandler = this.sendDiscoveryMessage

    this.running = false

    this.sendDiscoveryRequest()

    this.pingInterval = setInterval(() => this.sendDiscoveryRequest(), 2000);
  }

  handleCandidate(signal) {
    const rawData = typeof signal.data === 'string' ? signal.data : signal.data.candidate;

    const parts = rawData.replace(/^candidate:/, "").trim().split(" ");

    const parsedData = {
      candidate: signal.data,
      foundation: parts[0],
      component: parseInt(parts[1]),
      protocol: parts[2],
      priority: parseInt(parts[3]),
      address: parts[4],
      port: parseInt(parts[5]),
      type: parts[7],
      sdpMid: signal.data.sdpMid || "0",
      sdpMLineIndex: signal.data.sdpMLineIndex ?? 0
    };

    if (parts[8] === "raddr") parsedData.relatedAddress = parts[9];
    if (parts[10] === "rport") parsedData.relatedPort = parseInt(parts[11]);

    const ufragIndex = parts.indexOf("ufrag");
    if (ufragIndex !== -1) parsedData.usernameFragment = parts[ufragIndex + 1];

    this.rtcConnection.addIceCandidate(new RTCIceCandidate(parsedData)).catch(e => console.error("ICE:", e));
  }

  handleAnswer(signal) {
    if (!this.rtcConnection) return

    switch (this.rtcConnection.signalingState) {
      case "stable":
        console.error("Received answer in stable state, ignoring.")
        return
      case "closed":
        console.error("Received answer for closed connection, ignoring.")
        return
    }

    try {
      this.rtcConnection.setRemoteDescription({ type: 'answer', sdp: signal.data })
    } catch (e) {
      console.error("Failed to set remote description:", e)
    }
  }

  async createAssertion(fingerprint, token) {
    // The signing key MUST correspond to the public key that was sent to the
    // franchise auth service when this.token was issued (its 'cpk' claim is
    // bound to that public key). Signing with any other key - such as a
    // freshly generated, unrelated key pair - causes the server to reject the
    // identity assertion with ConnectError code 37 (identity verification failed).
    const pkcs8Key = this.identityPrivateKey
      ? this.identityPrivateKey.export({ type: "pkcs8", format: "pem" })
      : crypto.generateKeyPairSync("ec", { namedCurve: "P-384", privateKeyEncoding: { type: "pkcs8", format: "pem" } }).privateKey

    const payload = JSON.stringify({ fingerprint: [{ algorithm: "sha-256", digest: fingerprint }] });

    const ecPrivateKey = await importPKCS8(pkcs8Key, "ES384");
    const encoder = new TextEncoder();

    const jws = await new CompactSign(encoder.encode(payload)).setProtectedHeader({ alg: "ES384" }).sign(ecPrivateKey);

    const parts = jws.split(".");
    const fingerprints = `${parts[0]}..${parts[2]}`;

    const data = {
      assertion: JSON.stringify({
        fingerprints,
        token
      }),
      idp: {
        domain: "https://authorization.franchise.minecraft-services.net/",
        protocol: "default",
      }
    }

    return Buffer.from(JSON.stringify(data)).toString('base64')
  }

  async createOffer() {
    this.rtcConnection = new RTCPeerConnection({ iceServers: this.credentials, bundlePolicy: 'max-bundle' })
    this.connection = new Connection(this, this.connectionId, this.rtcConnection)

    const reliable = this.rtcConnection.createDataChannel('ReliableDataChannel', { ordered: true })
    const unreliable = this.rtcConnection.createDataChannel('UnreliableDataChannel', { ordered: false, maxRetransmits: 0 })
    this.connection.setChannels(reliable, unreliable)

    this.rtcConnection.onicecandidate = (event) => {
      if (!event.candidate) return

      if (event.candidate.candidate.includes("tcp") || event.candidate.candidate.includes("::1") || event.candidate.candidate.includes("127.0.0.1")) return;

      this.signalHandler(new SignalStructure(SignalType.CandidateAdd, this.connectionId, event.candidate.candidate, this.networkId, this.serverNetworkId))
    }

    this.rtcConnection.onconnectionstatechange = () => {
      const state = this.rtcConnection?.connectionState
      
      switch (state) {
        case "connected":
          this.emit('connected', this.connection)
          break;
        case "closed":
        case "disconnected":
        case "failed":
          this.emit('disconnect', this.connectionId, state)
          break;
      }
    }

    const offer = await this.rtcConnection.createOffer()
    const baseSdp = offer.sdp ?? ''

    const fingerprint = baseSdp.match(/^a=fingerprint:sha-256\s+(.*)$/m);
    const fingerprintValue = fingerprint[1];

    let sdp = baseSdp.replace(/^o=.*$/m, `o=- ${this.networkId} 2 IN IP4 127.0.0.1`);

    if (fingerprintValue) {
      const assertion = await this.createAssertion(fingerprintValue, this.token);

      sdp = sdp.replace(/^(a=fingerprint:sha-256\s+.*)$/m, `$1\na=identity:${assertion}`);
    }

    const localDescription = { type: offer.type, sdp }

    await this.rtcConnection.setLocalDescription(localDescription);

    this.signalHandler(new SignalStructure(SignalType.ConnectRequest, this.connectionId, sdp, this.networkId, this.serverNetworkId))
  }

  processPacket(buffer, rinfo) {
    const parsedPacket = processSecurePacket(buffer, this.deserializer)

    switch (parsedPacket.name) {
      case 'discovery_request':
        break
      case 'discovery_response':
        this.handleResponse(parsedPacket, rinfo)
        break
      case 'discovery_message':
        this.handleMessage(parsedPacket)
        break
      default:
        throw new Error('Unknown packet type')
    }
  }

  handleResponse(packet, rinfo) {
    const senderId = BigInt(packet.params.sender_id)
    this.addresses.set(senderId, rinfo)
    this.responses.set(senderId, packet.params)
    this.emit('pong', packet.params)
  }

  handleMessage(packet) {
    const data = packet.params.data
    if (data === 'Ping') return

    const signal = SignalStructure.fromString(data)
    signal.networkId = BigInt(packet.params.sender_id)

    this.handleSignal(signal)
  }

  handleSignal(signal) {
    switch (signal.type) {
      case SignalType.ConnectResponse:
        this.handleAnswer(signal)
        break
      case SignalType.CandidateAdd:
        if (signal.networkId === this.serverNetworkId) signal.networkId = this.networkId
        
        this.handleCandidate(signal)
        break
      case SignalType.ConnectError:
        this.handleConnectError(signal)
        break
    }
  }

  handleConnectError(signal) {
    console.error(`NetherNet connect error (code ${signal.data}) for connection ${signal.connectionId}`)

    // Nothing was listening for this before, so failed connections just hung
    // instead of ever resolving/rejecting or notifying the consumer.
    if (this.rtcConnection) {
      this.rtcConnection.close()
      this.rtcConnection = null
    }

    this.emit('disconnect', signal.connectionId, `connect_error:${signal.data}`)
  }

  sendDiscoveryRequest() {
    const packetData = createPacketData('discovery_request', PACKET_TYPE.DISCOVERY_REQUEST, this.networkId)
    const packetToSend = prepareSecurePacket(this.serializer, packetData)
    this.socket.send(packetToSend, PORT, this.broadcastAddress)
  }

  sendDiscoveryMessage(signal) {
    const rinfo = this.addresses.get(BigInt(signal.networkId))
    if (!rinfo) return

    const packetData = createPacketData('discovery_message', PACKET_TYPE.DISCOVERY_MESSAGE, this.networkId, {
      recipient_id: BigInt(signal.networkId),
      data: signal.toString()
    })

    const packetToSend = prepareSecurePacket(this.serializer, packetData)
    this.socket.send(packetToSend, rinfo.port, rinfo.address)
  }

  async connect() {
    this.running = true

    await this.createOffer()
  }

  send(buffer) {
    this.connection.send(buffer)
  }

  ping() {
    this.running = true

    this.sendDiscoveryRequest()
  }

  close(reason) {
    if (!this.running) return
    clearInterval(this.pingInterval)
    this.connection?.close()
    this.socket.close()
    this.connection = null
    this.running = false
    this.removeAllListeners()
  }
}

module.exports = { Client }