const PACKET_TYPE = {
  DISCOVERY_REQUEST: 0,
  DISCOVERY_RESPONSE: 1,
  DISCOVERY_MESSAGE: 2
}

const BinaryStream = require('@jsprismarine/jsbinaryutils').default

class Packet extends BinaryStream {
  constructor (id, buffer) {
    super(buffer)

    this.id = id
  }

  encode () {
    this.writeUnsignedShortLE(this.id)
    this.writeUnsignedLongLE(this.senderId)
    this.write(Buffer.alloc(8))
  }

  decode () {
    this.packetLength = this.readUnsignedShortLE()
    this.id = this.readUnsignedShortLE()
    this.senderId = this.readUnsignedLongLE()
    this.read(8)
  }

  prependLength () {
    const buf = Buffer.alloc(2)
    buf.writeUInt16LE(this.binary.length, 0)
    this.binary = [...buf, ...this.binary]
    this.writeIndex += 2
  }
}

module.exports = { PACKET_TYPE, Packet }
