const { ProtoDefCompiler, CompiledProtodef } = require('protodef').Compiler
const { FullPacketParser, Serializer } = require('protodef')

function createProtocol () {
  const protocol = require('../../data/newproto.json').types
  console.log('Proto', protocol)
  const compiler = new ProtoDefCompiler()
  compiler.addTypesToCompile(protocol)
  compiler.addTypes(require('../datatypes/compiler-minecraft'))
  compiler.addTypes(require('prismarine-nbt/compiler-zigzag'))

  const compiledProto = compiler.compileProtoDefSync()
  return compiledProto
}

function getProtocol () {
  const compiler = new ProtoDefCompiler()
  compiler.addTypes(require('../datatypes/compiler-minecraft'))
  compiler.addTypes(require('prismarine-nbt/compiler-zigzag'))

  const compile = (compiler, file) => {
    global.native = compiler.native // eslint-disable-line
    const { PartialReadError } = require('protodef/src/utils') // eslint-disable-line
    return require(file)() // eslint-disable-line
  }

  return new CompiledProtodef(
    compile(compiler.sizeOfCompiler, '../../data/size.js'),
    compile(compiler.writeCompiler, '../../data/write.js'),
    compile(compiler.readCompiler, '../../data/read.js')
    // compiler.sizeOfCompiler.compile(fs.readFileSync(__dirname + '/../../data/size.js', 'utf-8')),
    // compiler.writeCompiler.compile(fs.readFileSync(__dirname + '/../../data/write.js', 'utf-8')),
    // compiler.readCompiler.compile(fs.readFileSync(__dirname + '/../../data/read.js', 'utf-8'))
  )
}

function createSerializer () {
  const proto = getProtocol()
  return new Serializer(proto, 'mcpe_packet')
}

function createDeserializer () {
  const proto = getProtocol()
  return new FullPacketParser(proto, 'mcpe_packet')
}

module.exports = {
  createDeserializer: createDeserializer,
  createSerializer: createSerializer,
  createProtocol: createProtocol
}
