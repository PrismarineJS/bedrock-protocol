const { PACKET_TYPE, Packet } = require('./Packet')

class ResponsePacket extends Packet {
  constructor (data) {
    super(PACKET_TYPE.DISCOVERY_RESPONSE, data)
  }

  encode () {
    super.encode()
    const hex = this.data.toString('hex')

    this.writeUnsignedIntLE(hex.length)
    this.write(Buffer.from(hex, 'utf-8'))

    this.prependLength()

    return this
  }

  decode () {
    super.decode()
    const length = this.readUnsignedIntLE()
    this.data = Buffer.from(this.read(length).toString('utf-8'), 'hex')

    return this
  }
}

module.exports = { ResponsePacket }
