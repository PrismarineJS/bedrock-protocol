/* eslint-env mocha */

const assert = require('assert')
const { ProtoDef } = require('protodef')
const { ProtoDefCompiler } = require('protodef').Compiler
const minecraftTypes = require('../src/datatypes/minecraft')
const compiledMinecraftTypes = require('../src/datatypes/compiler-minecraft')

const testTypes = {
  MaybeIncompleteBytes: ['maybeIncompleteArray', { countType: 'varint', type: 'u8' }],
  TwoByteEntry: ['container', [
    { name: 'first', type: 'u8' },
    { name: 'second', type: 'u8' }
  ]],
  MaybeIncompleteTwoByteEntries: ['maybeIncompleteArray', { countType: 'varint', type: 'TwoByteEntry' }],
  OptionalByteOnRemaining: ['optionalOnRemaining', { type: 'u8' }]
}

function createInterpretedProtocol () {
  const protocol = new ProtoDef()
  protocol.addTypes(minecraftTypes)
  protocol.addTypes(testTypes)
  return protocol
}

function createCompiledProtocol () {
  const compiler = new ProtoDefCompiler()
  compiler.addTypes(compiledMinecraftTypes)
  compiler.addTypesToCompile(testTypes)
  return compiler.compileProtoDefSync()
}

for (const [implementation, createProtocol] of [
  ['interpreted', createInterpretedProtocol],
  ['compiled', createCompiledProtocol]
]) {
  describe(`${implementation} custom datatypes`, () => {
    const protocol = createProtocol()

    it('reads complete maybe-incomplete arrays', () => {
      const result = protocol.read(Buffer.from([2, 7, 8]), 0, 'MaybeIncompleteBytes')
      assert.deepStrictEqual(result, { value: [7, 8], size: 3 })
    })

    it('accepts packet EOF before the declared array count', () => {
      const result = protocol.read(Buffer.from([2, 7]), 0, 'MaybeIncompleteBytes')
      assert.deepStrictEqual(result, { value: [7], size: 2 })
    })

    it('writes the actual array count', () => {
      const buffer = protocol.createPacketBuffer('MaybeIncompleteBytes', [7, 8])
      assert.deepStrictEqual(buffer, Buffer.from([2, 7, 8]))
    })

    it('accepts EOF inside the final maybe-incomplete array element', () => {
      const result = protocol.read(Buffer.from([2, 1, 2, 3]), 0, 'MaybeIncompleteTwoByteEntries')
      assert.deepStrictEqual(result, { value: [{ first: 1, second: 2 }], size: 3 })
    })

    it('omits a terminal optional field when no bytes remain', () => {
      assert.deepStrictEqual(
        protocol.read(Buffer.alloc(0), 0, 'OptionalByteOnRemaining'),
        { value: undefined, size: 0 }
      )
      assert.deepStrictEqual(
        protocol.createPacketBuffer('OptionalByteOnRemaining', undefined),
        Buffer.alloc(0)
      )
    })

    it('reads and writes a terminal optional field when present', () => {
      assert.deepStrictEqual(
        protocol.read(Buffer.from([7]), 0, 'OptionalByteOnRemaining'),
        { value: 7, size: 1 }
      )
      assert.deepStrictEqual(
        protocol.createPacketBuffer('OptionalByteOnRemaining', 7),
        Buffer.from([7])
      )
    })
  })
}

describe('enum_size_based_on_values_len boundary (issue #669)', () => {
  // Regression test for https://github.com/PrismarineJS/bedrock-protocol/issues/669
  // A geyser server sent an available_commands packet with values_len = 256.
  // The enum value indices 0-255 fit in an unsigned byte, so the index type
  // must be 'byte'. Previously the limit was 0xff, which incorrectly selected
  // 'short' for 256 values, desynchronizing the parser (PartialReadError).
  // The full packet (7681 bytes) now parses completely.

  function makeParser (mcData) {
    const compiler = new ProtoDefCompiler()
    compiler.addTypes(compiledMinecraftTypes)
    compiler.addTypesToCompile(mcData.protocol.types)
    return new (require('protodef').FullPacketParser)(compiler.compileProtoDefSync(), 'mcpe_packet')
  }

  it('parses the 7681-byte available_commands packet from geyser (1.21.124)', function () {
    let mcData
    try {
      mcData = require('minecraft-data')('bedrock_1.21.124')
    } catch (e) {
      this.skip() // this minecraft-data version does not have 1.21.124 yet
      return
    }
    const fixture = require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'available_commands_1.21.124_geyser.bin'))
    const parser = makeParser(mcData)
    const result = parser.parsePacketBuffer(fixture)
    assert.strictEqual(result.data.name, 'available_commands')
    assert.strictEqual(result.data.params.values_len, 256)
    assert.strictEqual(result.metadata.size, fixture.length)
    assert.strictEqual(result.data.params.enums[0].name, 'refreshAliases')
    assert.strictEqual(result.data.params.enums[1].name, 'inventory')
  })
})
