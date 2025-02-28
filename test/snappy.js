const { Framer } = require('bedrock-protocol') // Import from bedrock-protocol

const mockClient = {
  batchHeader: 0xFE,
  compressionAlgorithm: 'snappy',
  compressionLevel: 6,
  compressionThreshold: 10,
  compressionHeader: 1,
  features: { compressorInHeader: true },
  compressionReady: true
}

module.exports = { mockClient }