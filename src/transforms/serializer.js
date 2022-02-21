const { ProtoDefCompiler, CompiledProtodef } = require('protodef').Compiler
const { FullPacketParser, Serializer } = require('protodef')
const { join } = require('path')

class Parser extends FullPacketParser {
  parsePacketBuffer (buffer) {
    try {
      return super.parsePacketBuffer(buffer)
    } catch (e) {
      console.error('While decoding', buffer.toString('hex'))
      throw e
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
