const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint
const zlib = require('zlib')

// Concatenates packets into one batch packet, and adds length prefixs.
class Framer {
  constructor (compressor, compressionLevel, compressionThreshold) {
    // Encoding
    this.packets = []
    this.compressor = compressor || 'none'
    this.compressionLevel = compressionLevel
    this.compressionThreshold = compressionThreshold
  }

  // No compression in base class
  compress (buffer) {
    switch (this.compressor) {
      case 'deflate': return zlib.deflateRawSync(buffer, { level: this.compressionLevel })
      case 'snappy': throw Error('Snappy compression not implemented')
      case 'none': return buffer
    }
  }

  static decompress (algorithm, buffer) {
    try {
      switch (algorithm) {
        case 'deflate': return zlib.inflateRawSync(buffer, { chunkSize: 512000 })
        case 'snappy': throw Error('Snappy compression not implemented')
        case 'none': return buffer
        default: throw Error('Unknown compression type ' + this.compressor)
      }
    } catch {
      return buffer
    }
  }

  static decode (compressor, buf) {
    // Read header
    if (buf[0] !== 0xfe) throw Error('bad batch packet header ' + buf[0])
    const buffer = buf.slice(1)
    const decompressed = this.decompress(compressor, buffer)
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

module.exports = { Framer }
