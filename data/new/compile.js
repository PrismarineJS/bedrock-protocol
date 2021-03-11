/**
 * This is a utility script that converts the YAML here into ProtoDef schema code and (soon) docs/typescript definitions.
 * It also pre-compiles JS code from the schema for easier development.
 *
 * You can run this with `npm run build`
 *
 */
const fs = require('fs')
const { ProtoDefCompiler } = require('protodef').Compiler

function genProtoSchema () {
  const { parse, compile } = require('protodef-yaml/compiler')

  // Create the packet_map.yml from proto.yml
  const parsed = parse('./proto.yml')
  const packets = []
  for (const key in parsed) {
    if (key.startsWith('%container')) {
      const [, name] = key.split(',')
      if (name.startsWith('packet_')) {
        const children = parsed[key]
        const packetName = name.replace('packet_', '')
        const packetID = children['!id']
        packets.push([packetID, packetName, name])
      }
    }
  }
  let l2 = ''
  let l1 = ''
  for (const [id, name, fname] of packets) {
    l1 += `      0x${id.toString(16).padStart(2, '0')}: ${name}\n`
    l2 += `      if ${name}: ${fname}\n`
  }
  const t = `!import: types.yaml\nmcpe_packet:\n   name: varint =>\n${l1}\n   params: name ?\n${l2}`
  fs.writeFileSync('./packet_map.yml', t)

  compile('./proto.yml', 'protocol.json')
}

genProtoSchema()

fs.writeFileSync('../newproto.json', JSON.stringify({ types: require('./protocol.json') }, null, 2))
fs.unlinkSync('./protocol.json') // remove temp file

function createProtocol () {
  const compiler = new ProtoDefCompiler()
  const protocol = require('../newproto.json').types
  compiler.addTypes(require('../../src/datatypes/compiler-minecraft'))
  compiler.addTypes(require('prismarine-nbt/compiler-zigzag'))
  compiler.addTypesToCompile(protocol)

  fs.writeFileSync('../read.js', 'module.exports = ' + compiler.readCompiler.generate())
  fs.writeFileSync('../write.js', 'module.exports = ' + compiler.writeCompiler.generate())
  fs.writeFileSync('../size.js', 'module.exports = ' + compiler.sizeOfCompiler.generate())

  const compiledProto = compiler.compileProtoDefSync()
  return compiledProto
}

console.log('Generating JS...')
createProtocol()
