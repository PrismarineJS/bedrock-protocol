/**
 * Pre-compiles JS code from the schema for easier development.
 * You can run this with `npm run build`
 */
const fs = require('fs')
const { ProtoDefCompiler } = require('protodef').Compiler
const { convert } = require('minecraft-data/minecraft-data/tools/js/compileProtocol')
const mcData = require('minecraft-data')
const { join } = require('path')
// Filter versions we support
const versions = mcData.versions.bedrock.filter(e => e.releaseType === 'release').map(e => e.minecraftVersion)

// Compile the ProtoDef JSON into JS
function createProtocol (version) {
  const compiler = new ProtoDefCompiler()
  const protocol = mcData('bedrock_' + version).protocol.types
  compiler.addTypes(require('../src/datatypes/compiler-minecraft'))
  compiler.addTypes(require('prismarine-nbt/compiler-zigzag'))
  compiler.addTypesToCompile(protocol)

  fs.writeFileSync('./read.js', 'module.exports = ' + compiler.readCompiler.generate().replace('() =>', 'native =>'))
  fs.writeFileSync('./write.js', 'module.exports = ' + compiler.writeCompiler.generate().replace('() =>', 'native =>'))
  fs.writeFileSync('./size.js', 'module.exports = ' + compiler.sizeOfCompiler.generate().replace('() =>', 'native =>'))

  const compiledProto = compiler.compileProtoDefSync()
  return compiledProto
}

function main (ver = 'latest') {
  // Put the .js files into the data/ dir, we also use the data dir when dumping packets for tests
  const dir = join(__dirname, '/../data/', ver)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  process.chdir(dir)
  console.log('Generating JS...', ver)
  createProtocol(ver)
}

require('minecraft-data/bin/generate_data')

// If no argument, build everything
if (!process.argv[2]) {
  convert('latest')
  for (const version of versions) {
    main(version)
  }
} else { // build the specified version
  main(process.argv[2])
}
