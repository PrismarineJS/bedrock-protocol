const [readVarInt, writeVarInt, sizeOfVarInt] = require('protodef').types.varint
const zlib = require('zlib')

// Concatenates packets into one batch packet, and adds length prefixs.
class Framer {
  constructor (client) {
    // Encoding
    this.packets = []
    this.batchHeader = client.batchHeader
    this.compressor = client.compressionAlgorithm || 'none'
    this.compressionLevel = client.compressionLevel
    this.compressionThreshold = client.compressionThreshold
    this.compressionHeader = client.compressionHeader || 0
    this.writeCompressor = client.features.compressorInHeader && client.compressionReady
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
    switch (algorithm) {
      case 0:
      case 'deflate':
        return zlib.inflateRawSync(buffer, { chunkSize: 512000 })
      case 1:
      case 'snappy':
        throw Error('Snappy compression not implemented')
      case 'none':
      case 255:
        return buffer
      default: throw Error('Unknown compression type ' + algorithm)
    }
  }

  static decode (client, buf) {
    // Read header
    if (this.batchHeader && buf[0] !== this.batchHeader) throw Error(`bad batch packet header, received: ${buf[0]}, expected: ${this.batchHeader}`)
    const buffer = buf.slice(1)
    // Decompress
    let decompressed
    if (client.features.compressorInHeader && client.compressionReady) {
      decompressed = this.decompress(buffer[0], buffer.slice(1))
    } else {
      // On old versions, compressor is session-wide ; failing to decompress
      // a packet will assume it's not compressed
      try {
        decompressed = this.decompress(client.compressionAlgorithm, buffer)
      } catch (e) {
        decompressed = buffer
      }
    }
    return Framer.getPackets(decompressed)
  }

  encode () {
    const buf = Buffer.concat(this.packets)
    const shouldCompress = buf.length > this.compressionThreshold
    const header = this.batchHeader ? [this.batchHeader] : []
    if (this.writeCompressor) header.push(shouldCompress ? this.compressionHeader : 255)
    return Buffer.concat([Buffer.from(header), shouldCompress ? this.compress(buf) : buf])
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
