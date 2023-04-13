const { ProtoDefCompiler, CompiledProtodef } = require('protodef').Compiler
const { FullPacketParser, Serializer } = require('protodef')
const { join } = require('path')
const fs = require('fs')

class Parser extends FullPacketParser {
  dumpFailedBuffer (packet, prefix = '') {
    if (packet.length > 1000) {
      const now = Date.now()
      fs.writeFileSync(now + '_packetReadError.txt', packet.toString('hex'))
      console.log(prefix, `Deserialization failure for packet 0x${packet.slice(0, 1).toString('hex')}. Packet buffer saved in ./${now}_packetReadError.txt as buffer was too large (${packet.length} bytes).`)
    } else {
      console.log(prefix, 'Read failure for 0x' + packet.slice(0, 1).toString('hex'), packet.slice(0, 1000))
    }
  }

  verify (deserialized, serializer) {
    const { name, params } = deserialized.data
    const oldBuffer = deserialized.fullBuffer
    const newBuffer = serializer.createPacketBuffer({ name, params })
    if (!newBuffer.equals(oldBuffer)) {
      const fs = require('fs')
      fs.writeFileSync('new.bin', newBuffer)
      fs.writeFileSync('old.bin', oldBuffer)
      fs.writeFileSync('failed.json', JSON.stringify(params, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2))
      console.warn('Failed to re-encode', name)
    }
  }
}

// Compiles the ProtoDef schema at runtime
function createProtocol (version) {
  // Try and load from .js if available
  try { require(`../../data/${version}/size.js`); return getProtocol(version) } catch {}

  const protocol = require('minecraft-data')('bedrock_' + version).protocol
  const compiler = new ProtoDefCompiler()
  compiler.addTypesToCompile(protocol.types)
  compiler.addTypes(require('../datatypes/compiler-minecraft'))
  compiler.addTypes(require('prismarine-nbt/compiler-zigzag'))

  const compiledProto = compiler.compileProtoDefSync()
  return compiledProto
}

// Loads already generated read/write/sizeof code
function getProtocol (version) {
  const compiler = new ProtoDefCompiler()
  compiler.addTypes(require(join(__dirname, '../datatypes/compiler-minecraft')))
  compiler.addTypes(require('prismarine-nbt/compiler-zigzag'))

  global.PartialReadError = require('protodef/src/utils').PartialReadError
  const compile = (compiler, file) => require(file)(compiler.native)

  return new CompiledProtodef(
    compile(compiler.sizeOfCompiler, join(__dirname, `../../data/${version}/size.js`)),
    compile(compiler.writeCompiler, join(__dirname, `../../data/${version}/write.js`)),
    compile(compiler.readCompiler, join(__dirname, `../../data/${version}/read.js`))
  )
}

function createSerializer (version) {
  const proto = createProtocol(version)
  return new Serializer(proto, 'mcpe_packet')
}

function createDeserializer (version) {
  const proto = createProtocol(version)
  return new Parser(proto, 'mcpe_packet')
}

module.exports = {
  createDeserializer,
  createSerializer,
  createProtocol,
  getProtocol
}
