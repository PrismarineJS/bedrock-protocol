const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint
const zlib = require('zlib')

// Concatenates packets into one batch packet, and adds length prefixs.
class Framer {
  constructor () {
    // Encoding
    this.packets = []
    this.compressionLevel = 7
  }

  static decode (buf, cb) {
    // Read header
    if (buf[0] !== 0xfe) throw Error('bad batch packet header ' + buf[0])
    const buffer = buf.slice(1)

    // Decode the payload
    zlib.inflateRaw(buffer, { chunkSize: 1024 * 1024 * 2 }, (err, inflated) => {
      if (err) { // Try to decode without compression
        Framer.getPackets(buffer)
        return
      }
      cb(Framer.getPackets(inflated))
    })
  }

  encode (cb) {
    const buf = Buffer.concat(this.packets)
    zlib.deflateRaw(buf, { level: this.compressionLevel }, (err, def) => {
      if (err) throw err
      const ret = Buffer.concat([Buffer.from([0xfe]), def])
      cb(ret)
    })
  }

  addEncodedPacket (chunk) {
    const varIntSize = sizeOfVarInt(chunk.byteLength)
    const buffer = Buffer.allocUnsafe(varIntSize + chunk.byteLength)
    writeVarInt(chunk.length, buffer, 0)
    chunk.copy(buffer, varIntSize)
    this.packets.push(buffer)
  }

  addEncodedPackets (packets) {
    let allocSize = 0
    for (const packet of packets) {
      allocSize += sizeOfVarInt(packet.byteLength)
      allocSize += packet.byteLength
    }
    const buffer = Buffer.allocUnsafe(allocSize)
    let offset = 0
    for (const chunk of packets) {
      offset = writeVarInt(chunk.length, buffer, offset)
      offset += chunk.copy(buffer, offset, 0)
    }

    this.packets.push(buffer)
  }

  getBuffer () {
    return Buffer.concat(this.packets)
  }

  static getPackets (buffer) {
    const packets = []
    let offset = 0
    while (offset < buffer.byteLength) {
      const { value, size } = readVarInt(buffer, offset)
      const dec = Buffer.allocUnsafe(value)
      offset += size
      offset += buffer.copy(dec, 0, offset, offset + value)
      packets.push(dec)
    }
    return packets
  }
}

module.exports = Framer
