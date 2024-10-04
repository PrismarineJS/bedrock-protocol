const { PACKET_TYPE, Packet } = require('./Packet')

class RequestPacket extends Packet {
  constructor (data) {
    super(PACKET_TYPE.DISCOVERY_REQUEST, data)
  }

  encode () {
    super.encode()

    this.prependLength()

    return this
  }

  decode () {
    super.decode()

    return this
  }
}

module.exports = { RequestPacket }
