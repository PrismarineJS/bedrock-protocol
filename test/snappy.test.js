const { Framer } = require("bedrock-protocol/src/transforms/framer")
const { mockClient } = require("./snappy")

describe('Framer Snappy Compression', () => {
    test('compress and decompress using Snappy via Framer', () => {
        const framer = new Framer(mockClient)
        const inputBuffer = Buffer.from('This is a test for Snappy compression')

        const compressed = framer.compress(inputBuffer)
        expect(compressed).not.toEqual(inputBuffer)

        const decompressed = Framer.decompress(mockClient.compressionAlgorithm, compressed)
        expect(decompressed.toString()).toEqual(inputBuffer.toString())
    })
})
