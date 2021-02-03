const BinaryStream = require('@jsprismarine/jsbinaryutils').default
const Listener = require('@jsprismarine/raknet/listener')
const { ProtoDef, Parser, Serializer } = require('protodef')
const BatchPacket = require('./BatchPacket')
const { EventEmitter } = require('events')
const cipher = require('./transforms/encryption')
const { Encrypt } = require('./auth/encryption')

const { decodeLoginJWT } = require('./auth/jwt')
const EncapsulatedPacket = require('@jsprismarine/raknet/protocol/encapsulated_packet')


var protocol = require('../data/newproto.json').types;

function createProtocol() {
  var proto = new ProtoDef();
  proto.addTypes(require('./datatypes/minecraft'));
  proto.addTypes(protocol);

  return proto;
}

function createSerializer() {
  var proto = createProtocol()
  return new Serializer(proto, 'mcpe_packet');
}

function createDeserializer() {
  var proto = createProtocol()
  return new Parser(proto, 'mcpe_packet');
}

const PLAY_STATUS = {
  'LoginSuccess': 0,
  'LoginFailedClient': 1,
  'LoginFailedServer': 2,
  'PlayerSpawn': 3,
  'LoginFailedInvalidTenant': 4,
  'LoginFailedVanillaEdu': 5,
  'LoginFailedEduVanilla': 6,
  'LoginFailedServerFull': 7
}

class Player extends EventEmitter {
  constructor(server, connection, options) {
    super()
    this.server = server
    this.connection = connection
    Encrypt(this, server, options)
  }

  getData() {
    return this.userData
  }

  onLogin(packet) {
    let body = packet.data
    console.log('Body', body)

    const clientVer = body.protocol_version
    if (this.server.options.version) {
      if (this.server.options.version < clientVer) {
        this.sendDisconnectStatus(PLAY_STATUS.LoginFailedClient)
        return
      }
    } else if (clientVer < MIN_VERSION) {
      this.sendDisconnectStatus(PLAY_STATUS.LoginFailedClient)
      return
    }

    // Parse login data
    const authChain = JSON.parse(body.params.chain)
    const skinChain = body.params.client_data

    try {
      var { key, userData, chain } = decodeLoginJWT(authChain.chain, skinChain)
    } catch (e) {
      console.error(e)
      throw new Error('Failed to verify user')
    }
    console.log('Verified user', 'got pub key', key, userData)

    this.emit('login', { user: userData.extraData }) // emit events for user
    this.emit('server.client_handshake', { key }) // internal so we start encryption

    this.userData = userData.extraData
    this.version = clientVer
  }

  sendDisconnectStatus(play_status) {
    this.write('play_status', { status: play_status })
    this.connection.close()
  }

  // After sending Server to Client Handshake, this handles the client's
  // Client to Server handshake response. This indicates successful encryption
  onHandshake() {
    // https://wiki.vg/Bedrock_Protocol#Play_Status
    this.write('play_status', { status: PLAY_STATUS.LoginSuccess })
    this.emit('join')
  }

  startEncryption(iv) {
    this.encryptionEnabled = true

    this.decrypt = cipher.createDecryptor(this, iv)
    this.encrypt = cipher.createEncryptor(this, iv)
  }

  write(name, params) { // TODO: Batch
    console.log('Need to encode', name, params)
    const batch = new BatchPacket()
    const packet = this.server.serializer.createPacketBuffer({ name, params })
    batch.addEncodedPacket(packet)

    if (this.encryptionEnabled) {
      this.sendEncryptedBatch(batch)
    } else {
      this.sendDecryptedBatch(batch)
    }
  }

  writeRaw(name, buffer) { // skip protodef serializaion
    // temporary hard coded stuff
    const batch = new BatchPacket()
    if (name == 'biome_definition_list') {
      // so we can send nbt straight from file without parsing
      const stream = new BinaryStream()
      stream.writeUnsignedVarInt(0x7a)
      stream.append(buffer)
      batch.addEncodedPacket(stream.getBuffer())
      // console.log('----- SENDING BIOME DEFINITIONS')
    }

    if (this.encryptionEnabled) {
      this.sendEncryptedBatch(batch)
    } else {
      this.sendDecryptedBatch(batch)
    }
  }

  sendDecryptedBatch(batch) {
    const buf = batch.encode()
    // send to raknet
    const sendPacket = new EncapsulatedPacket();
    sendPacket.reliability = 0;
    sendPacket.buffer = buf

    this.connection.addEncapsulatedToQueue(sendPacket)
    this.connection.sendQueue()
  }

  sendEncryptedBatch(batch) {
    const buf = batch.stream.getBuffer()
    console.log('Sending encrypted batch', batch)
    this.encrypt(buf)
  }

  // These are callbacks called from encryption.js
  onEncryptedPacket = (buf) => {
    console.log('ENC BUF', buf)
    const packet = Buffer.concat([Buffer.from([0xfe]), buf]) // add header
    const sendPacket = new EncapsulatedPacket();
    sendPacket.reliability = 0
    sendPacket.buffer = packet
    console.log('Sending wrapped encrypted batch', packet)
    this.connection.addEncapsulatedToQueue(sendPacket)
  }

  onDecryptedPacket = (buf) => {
    console.log('Decrypted', buf)

    const stream = new BinaryStream(buf)
    const packets = BatchPacket.getPackets(stream)

    for (const packet of packets) {
      this.readPacket(packet)
    }
  }

  readPacket(packet) {
    console.log('packet', packet)
    const des = this.server.deserializer.parsePacketBuffer(packet)
    console.log('->', des)
    switch (des.data.name) {
      case 'login':
        console.log(des)
        this.onLogin(des)
        return
      case 'client_to_server_handshake':
        this.onHandshake()
      default:
        console.log('ignoring, unhandled')
    }
    this.emit(des.data.name, des.data.params)

  }

  handle(buffer) { // handle encapsulated
    if (buffer[0] == 0xfe) { // wrapper

      if (this.encryptionEnabled) {
        // console.log('READING ENCRYPTED PACKET', buffer)
        this.decrypt(buffer.slice(1))
      } else {
        const stream = new BinaryStream(buffer)
        const batch = new BatchPacket(stream)
        batch.decode()
        const packets = batch.getPackets()
        console.log('Reading ', packets.length, 'packets')
        for (var packet of packets) {
          this.readPacket(packet)
        }
      }
    }
  }
}

// Minimum supported version (< will be kicked)
const MIN_VERSION = 422
// Currently supported verson
const CURRENT_VERSION = 422

const defaultServerOptions = {
  // https://minecraft.gamepedia.com/Protocol_version#Bedrock_Edition_2
  version: CURRENT_VERSION,
}

class Server extends EventEmitter {
  constructor(options) {
    super()
    this.options = { ...defaultServerOptions, options }
    this.serializer = createSerializer()
    this.deserializer = createDeserializer()
    this.clients = {}
    this.validateOptions()
  }

  validateOptions() {
    if (this.options.version < defaultServerOptions.version) {
      throw new Error(`Unsupported protocol version < ${defaultServerOptions.version}: ${this.options.version}`)
    }
  }

  getAddrHash(inetAddr) {
    return inetAddr.address + '/' + inetAddr.port
  }

  onOpenConnection = (conn) => {
    console.log('Got connection', conn)
    const player = new Player(this, conn)
    this.clients[this.getAddrHash(conn.address)] = player

    this.emit('connect', { client: player })
  }

  onCloseConnection = (inetAddr, reason) => {
    console.log('Close connection', inetAddr, reason)
    delete this.clients[this.getAddrHash(inetAddr)]
  }

  onEncapsulated = (encapsulated, inetAddr) => {
    console.log('Encapsulated', encapsulated, inetAddr)
    const buffer = encapsulated.buffer
    const client = this.clients[this.getAddrHash(inetAddr)]
    if (!client) {
      throw new Error(`packet from unknown inet addr: ${inetAddr.address}/${inetAddr.port}`)
    }
    client.handle(buffer)
  }

  async create(serverIp, port) {
    this.listener = new Listener(this)
    this.raknet = await this.listener.listen(serverIp, port)
    console.log('Listening on', serverIp, port)

    this.raknet.on('openConnection', this.onOpenConnection)
    this.raknet.on('closeConnection', this.onCloseConnection)
    this.raknet.on('encapsulated', this.onEncapsulated)

    this.raknet.on('raw', (buffer, inetAddr) => {
      console.log('Raw packet', buffer, inetAddr)
    })
  }
}

module.exports = { Server, Player, PLAY_STATUS }