/**
 * This is a utility script that converts the YAML here into ProtoDef schema code and (soon) docs/typescript definitions.
 * It also pre-compiles JS code from the schema for easier development.
 *
 * You can run this with `npm run build`
 *
 */
const fs = require('fs')
const { ProtoDefCompiler } = require('protodef').Compiler

// Parse the YML files and turn to JSON
function genProtoSchema () {
  const { parse, compile } = require('protodef-yaml/compiler')

  // Create the packet_map.yml from proto.yml
  const parsed = parse('./proto.yml')
  const version = parsed['!version']
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
  let l1 = ''
  let l2 = ''
  for (const [id, name, fname] of packets) {
    l1 += `      0x${id.toString(16).padStart(2, '0')}: ${name}\n`
    l2 += `      if ${name}: ${fname}\n`
  }
  // TODO: skip creating packet_map.yml and just generate the ProtoDef map JSON directly
  const t = `#Auto-generated from proto.yml, do not modify\n!import: types.yaml\nmcpe_packet:\n   name: varint =>\n${l1}\n   params: name ?\n${l2}`
  fs.writeFileSync('./packet_map.yml', t)

  compile('./proto.yml', 'protocol.json')
  return version
}

// Compile the ProtoDef JSON into JS
function createProtocol (version) {
  const compiler = new ProtoDefCompiler()
  const protocol = require(`../${version}/protocol.json`).types
  compiler.addTypes(require('../../src/datatypes/compiler-minecraft'))
  compiler.addTypes(require('prismarine-nbt/compiler-zigzag'))
  compiler.addTypesToCompile(protocol)

  fs.writeFileSync(`../${version}/read.js`, 'module.exports = ' + compiler.readCompiler.generate())
  fs.writeFileSync(`../${version}/write.js`, 'module.exports = ' + compiler.writeCompiler.generate())
  fs.writeFileSync(`../${version}/size.js`, 'module.exports = ' + compiler.sizeOfCompiler.generate())

  const compiledProto = compiler.compileProtoDefSync()
  return compiledProto
}

function main () {
  const version = genProtoSchema()

  fs.writeFileSync(`../${version}/protocol.json`, JSON.stringify({ types: require('./protocol.json') }, null, 2))
  fs.unlinkSync('./protocol.json') // remove temp file
  fs.unlinkSync('./packet_map.yml') // remove temp file

  console.log('Generating JS...')
  createProtocol(version)
}

main()
