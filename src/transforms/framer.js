const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint
const zlib = require('zlib')

// Concatenates packets into one batch packet, and adds length prefixs.
class Framer {
  constructor (compressionLevel, compressionThreshold) {
    // Encoding
    this.packets = []
    this.compressionLevel = compressionLevel
    this.compressionThreshold = compressionThreshold
  }

  // No compression in base class
  compress (buffer) { return buffer }
  static decompress (buffer) { return buffer }

  static decode (buf) {
    // Read header
    if (buf[0] !== 0xfe) throw Error('bad batch packet header ' + buf[0])
    const buffer = buf.slice(1)
    const decompressed = this.decompress(buffer)
    return Framer.getPackets(decompressed)
  }

  encode () {
    const buf = Buffer.concat(this.packets)
    const compressed = (buf.length > this.compressionThreshold) ? this.compress(buf) : buf
    return Buffer.concat([Buffer.from([0xfe]), compressed])
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

class DeflateFramer extends Framer {
  compress (buffer) {
    return zlib.deflateRawSync(buffer, { level: this.compressionLevel })
  }

  static decompress (buffer) {
    // Decode the payload with 512kb buffer
    try {
      return zlib.inflateRawSync(buffer, { chunkSize: 512000 })
    } catch (e) { // Try to decode without compression
      return buffer
    }
  }
}

class SnappyFramer extends Framer {
  compress (buffer) {
    throw Error('Snappy compression not implemented')
  }

  static decompress (buffer) {
    throw Error('Snappy compression not implemented')
  }
}

module.exports = { Framer, DeflateFramer, SnappyFramer }
