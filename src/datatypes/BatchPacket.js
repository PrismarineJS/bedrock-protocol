const BinaryStream = require('@jsprismarine/jsbinaryutils').default
const Zlib = require('zlib')

const NETWORK_ID = 0xfe

// This is not a real MCPE packet, it's a wrapper that contains compressed/encrypted batched packets
class BatchPacket {
  constructor (stream) {
    // Shared
    this.payload = Buffer.alloc(0)
    this.stream = stream || new BinaryStream()

    // Decoding
    this.packets = []

    // Encoding
    this.compressionLevel = 7
    this.count = 0
  }

  decode () {
    // Read header
    const pid = this.stream.readByte()
    if (!pid === NETWORK_ID) {
      throw new Error(`Batch ID mismatch: is ${BatchPacket.NETWORK_ID}, got ${pid}`) // this is not a BatchPacket
    }

    // Decode the payload
    try {
      this.payload = Zlib.inflateRawSync(this.stream.readRemaining(), {
        chunkSize: 1024 * 1024 * 2
      })
    } catch (e) {
      console.error(e)
      console.debug(`[bp] Error decompressing packet ${pid}`)
    }
  }

  encode () {
    const buf = this.stream.getBuffer()
    console.log('Encoding payload', buf)
    const def = Zlib.deflateRawSync(buf, { level: this.compressionLevel })
    const ret = Buffer.concat([Buffer.from([0xfe]), def])
    console.log('Compressed', ret)
    return ret
  }

  addEncodedPacket (packet) {
    this.stream.writeUnsignedVarInt(packet.byteLength)
    this.stream.append(packet)
    this.count++
  }

  getPackets () {
    const stream = new BinaryStream()
    stream.buffer = this.payload
    const packets = []
    while (!stream.feof()) {
      const length = stream.readUnsignedVarInt()
      const buffer = stream.read(length)
      packets.push(buffer)
    }

    return packets
  }

  static getPackets (stream) {
    const packets = []
    while (!stream.feof()) {
      const length = stream.readUnsignedVarInt()
      const buffer = stream.read(length)
      packets.push(buffer)
    }

    return packets
  }
}

module.exports = BatchPacket
