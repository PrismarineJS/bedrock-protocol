const { PACKET_TYPE, Packet } = require('./Packet')

class MessagePacket extends Packet {
  constructor (data) {
    super(PACKET_TYPE.DISCOVERY_MESSAGE, data)
  }

  encode () {
    super.encode()
    this.writeUnsignedLongLE(this.recipientId)

    this.writeUnsignedIntLE(this.data.length)
    this.write(Buffer.from(this.data, 'utf-8'))

    this.prependLength()

    return this
  }

  decode () {
    super.decode()
    this.recipientId = this.readUnsignedLongLE()

    const length = this.readUnsignedIntLE()
    this.data = this.read(length).toString()

    return this
  }
}

module.exports = { MessagePacket }
