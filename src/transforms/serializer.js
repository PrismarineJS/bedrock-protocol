const { ProtoDefCompiler } = require('protodef').Compiler
const { FullPacketParser, Serializer } = require('protodef')

const protocol = require("../protocol/protocol.json")
const compiler = new ProtoDefCompiler()

compiler.addTypesToCompile(protocol.types)
compiler.addTypes(require('../datatypes/compiler-minecraft'))

const proto = compiler.compileProtoDefSync()

const PROTOCOL_VERSION = 2169
const GAME_VERSION = '1.26.45'

function createSerializer() {
  return new Serializer(proto, 'mcpe_packet')
}

function createDeserializer() {
  return new FullPacketParser(proto, 'mcpe_packet')
}

module.exports = { createDeserializer, createSerializer, PROTOCOL_VERSION, GAME_VERSION }