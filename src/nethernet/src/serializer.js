const { ProtoDefCompiler } = require('protodef').Compiler
const { FullPacketParser, Serializer } = require('protodef')
const protocol = require('./protocol.json')
const proto = createProtocol()

const PACKET_TYPE = {
  DISCOVERY_REQUEST: 0,
  DISCOVERY_RESPONSE: 1,
  DISCOVERY_MESSAGE: 2
}

function createProtocol () {
  const compiler = new ProtoDefCompiler()
  compiler.addTypesToCompile(protocol.types)
  compiler.addTypes(require('./compilerTypes'))

  const compiledProto = compiler.compileProtoDefSync()
  return compiledProto
}

function createSerializer () {
  return new Serializer(proto, 'nethernet_packet')
}

function createDeserializer () {
  return new FullPacketParser(proto, 'nethernet_packet')
}

module.exports = { PACKET_TYPE, createDeserializer, createSerializer, createProtocol }