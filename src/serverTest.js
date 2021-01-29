console.log('IMPORTING')
const BinaryStream = require('@jsprismarine/jsbinaryutils').default
const Listener = require('@jsprismarine/raknet/listener')
const { ProtoDef, Parser, Serializer } = require('protodef')
const BatchPacket = require('./BatchPacket')
const { EventEmitter } = require('events')
const fs = require('fs')
const cipher = require('./transforms/encryption')
const { Encrypt } = require('./auth/encryption')

const { decodeLoginJWT } = require('./auth/jwt')
const EncapsulatedPacket = require('@jsprismarine/raknet/protocol/encapsulated_packet')
console.log('IMPORTED')
// const Zlib = require('zlib');

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

class Player extends EventEmitter {
  constructor(server, connection, options) {
    super()
    this.server = server
    this.connection = connection
    Encrypt(this, server, options)
  }

  // TODO: Move this to a protodef native type
  onLogin(packet) {
    let dataProto = new ProtoDef()
    dataProto.addType('data_chain', ['container', [{
      'name': 'chain',
      'type': ['pstring', {
        'countType': 'li32'
      }]
    }, {
      'name': 'clientData',
      'type': ['pstring', {
        'countType': 'li32'
      }]
    }]])

    //FIXME: Xbox & Non-Xbox support
    console.log(packet);
    let pbody = packet.data.params.payload
    let body = dataProto.parsePacketBuffer('data_chain', pbody)
    console.log('Body', body)

    fs.writeFileSync('login.json', JSON.stringify(body))

    // Parse login data
    const authChain = JSON.parse(body.data.chain)
    const skinChain = body.data.clientData

    try {
      var { key, userData, chain } = decodeLoginJWT(authChain.chain, skinChain)
    } catch (e) {
      console.error(e)
      throw new Error('Failed to verify user')
    }
    console.log('Verified user', 'got pub key', key, userData)

    this.emit('join', {
      user: userData.extraData
    })
    this.emit('server.client_handshake', {
      key
    })
  }

  startEncryption(iv) {
    this.encryptionEnabled = true

    // this.cipher = cipher.createCipher(client.secretKeyBytes, iv)
    // this.decipher = cipher.createDecipher(client.secretKeyBytes, iv)

    this.decrypt = cipher.createDecryptor(this, iv)
    this.encrypt = cipher.createDecryptor(this, iv)
  }

  write(name, params) {
    console.log('Need to encode', name, params)
    const batch = new BatchPacket()
    const packet = this.server.serializer.createPacketBuffer({ name, params })
    batch.addEncodedPacket(packet)
    const buf = batch.encode()
    // send to raknet
    const sendPacket = new EncapsulatedPacket();
    sendPacket.reliability = 0;
    sendPacket.buffer = buf

    this.connection.addEncapsulatedToQueue(sendPacket, 1)
    this.connection.sendQueue()
  }

  sendDecryptedBatch(batch) {

  }

  sendEncryptedBatch(batch) {
    
  }

  onDecryptedPacket = (buf) => {
    console.log('Decrypted', buf)
  }

  readPacket(packet) {
    console.log('packet', packet)
    const des = this.server.deserializer.parsePacketBuffer(packet)
    console.log(des)
    switch (des.data.name) {
      case 'login':
        console.log(des)
        this.onLogin(des)
      default:
        this.emit(des.data.name, des.data.params)
    }
  }

  handle(buffer) { // handle encapsulated
    if (buffer[0] == 0xfe) { // wrapper

      if (this.encryptionEnabled) {
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

class Server extends EventEmitter {
  constructor(options = {}) {
    // const customTypes = require('./datatypes/minecraft')
    // this.batchProto = new ProtoDef()
    // this.batchProto.addTypes(customTypes)
    // this.batchProto.addType('insideBatch', ['endOfArray', {
    //   'type': ['buffer', {
    //     'countType': 'varint',
    //   }]
    // }])

    super()

    this.serializer = createSerializer()
    this.deserializer = createDeserializer()

    this.clients = {}
  }

  getAddrHash(inetAddr) {
    return inetAddr.address + '/' + inetAddr.port
  }

  onOpenConnection = (conn) => {
    console.log('Got connection', conn)
    this.clients[this.getAddrHash(conn.address)] = new Player(this, conn)
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
      console.warn('packet from unknown inet addr', inetAddr.address, inetAddr.port)
      return
    }
    client.handle(buffer)
  }

  // write(name, params) {
  //   console.log('Need to encode', name, params)
  //   const batch = new BatchPacket()
  //   const packet = this.serializer.createPacketBuffer({ name, params })
  //   batch.addEncodedPacket(packet)
  //   const buf = batch.encode()
  //   // send to raknet
  //   this.listener.sendBuffer()
  // }

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

let server = new Server()
server.create('0.0.0.0', 19130)