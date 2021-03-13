const { ProtoDefCompiler, CompiledProtodef } = require('protodef').Compiler
const { FullPacketParser, Serializer } = require('protodef')

// Compiles the ProtoDef schema at runtime
function createProtocol (version) {
  const protocol = require(`../../data/${version}/protocol.json`).types
  const compiler = new ProtoDefCompiler()
  compiler.addTypesToCompile(protocol)
  compiler.addTypes(require('../datatypes/compiler-minecraft'))
  compiler.addTypes(require('prismarine-nbt/compiler-zigzag'))

  const compiledProto = compiler.compileProtoDefSync()
  return compiledProto
}

// Loads already generated read/write/sizeof code
function getProtocol (version) {
  const compiler = new ProtoDefCompiler()
  compiler.addTypes(require('../datatypes/compiler-minecraft'))
  compiler.addTypes(require('prismarine-nbt/compiler-zigzag'))

  const compile = (compiler, file) => {
    global.native = compiler.native // eslint-disable-line
    const { PartialReadError } = require('protodef/src/utils') // eslint-disable-line
    return require(file)() // eslint-disable-line
  }

  return new CompiledProtodef(
    compile(compiler.sizeOfCompiler, `../../data/${version}/size.js`),
    compile(compiler.writeCompiler, `../../data/${version}/write.js`),
    compile(compiler.readCompiler, `../../data/${version}/read.js`)
  )
}

function createSerializer (version) {
  const proto = getProtocol(version)
  return new Serializer(proto, 'mcpe_packet')
}

function createDeserializer (version) {
  const proto = getProtocol(version)
  return new FullPacketParser(proto, 'mcpe_packet')
}

module.exports = {
  createDeserializer: createDeserializer,
  createSerializer: createSerializer,
  createProtocol: createProtocol
}
