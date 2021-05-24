/**
 * This is a utility script that converts the YAML here into ProtoDef schema code and (soon) docs/typescript definitions.
 * It also pre-compiles JS code from the schema for easier development.
 *
 * You can run this with `npm run build`
 *
 */
const fs = require('fs')
const { ProtoDefCompiler } = require('protodef').Compiler
const { Versions } = require('../src/options')
const { join } = require('path')

function getJSON (path) {
  return JSON.parse(fs.readFileSync(path, 'utf-8'))
}

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

  compile('./proto.yml', 'proto.json')
  return version
}

// Compile the ProtoDef JSON into JS
function createProtocol () {
  const compiler = new ProtoDefCompiler()
  const protocol = getJSON('./protocol.json').types
  compiler.addTypes(require('../src/datatypes/compiler-minecraft'))
  compiler.addTypes(require('prismarine-nbt/compiler-zigzag'))
  compiler.addTypesToCompile(protocol)

  fs.writeFileSync('./read.js', 'module.exports = ' + compiler.readCompiler.generate().replace('() =>', 'native =>'))
  fs.writeFileSync('./write.js', 'module.exports = ' + compiler.writeCompiler.generate().replace('() =>', 'native =>'))
  fs.writeFileSync('./size.js', 'module.exports = ' + compiler.sizeOfCompiler.generate().replace('() =>', 'native =>'))

  const compiledProto = compiler.compileProtoDefSync()
  return compiledProto
}

function copyLatest () {
  process.chdir(join(__dirname, '/../data/latest'))
  const version = genProtoSchema()
  try { fs.mkdirSync(`../${version}`) } catch {}
  fs.writeFileSync(`../${version}/protocol.json`, JSON.stringify({ types: getJSON('./proto.json') }, null, 2))
  fs.unlinkSync('./proto.json') // remove temp file
  fs.unlinkSync('./packet_map.yml') // remove temp file
  return version
}

function main (ver = 'latest') {
  if (ver === 'latest') ver = copyLatest()
  process.chdir(join(__dirname, '/../data/', ver))
  console.log('Generating JS...', ver)
  createProtocol(ver)
}

// If no argument, build everything
if (!process.argv[2]) {
  copyLatest()
  for (const version in Versions) {
    main(version)
  }
} else { // build the specified version
  main(process.argv[2])
}
