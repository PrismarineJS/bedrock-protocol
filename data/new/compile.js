const fs = require('fs')
const { ProtoDefCompiler } = require('protodef').Compiler

let compile
try {
    compile = require('protodef-yaml/compiler').compile
} catch (e) {
    require('child_process').execSync('npx protodef-yaml proto.yml protocol.json')
}

if (compile) {
    compile('./proto.yml', 'protocol.json')
}

fs.writeFileSync('../newproto.json', JSON.stringify({ types: require('./protocol.json') }, null, 2))
fs.unlinkSync('./protocol.json') //remove temp file

function createProtocol() {
    const compiler = new ProtoDefCompiler()
    const protocol = require('../newproto.json').types
    compiler.addTypesToCompile(protocol)
    compiler.addTypes(require('../../src/datatypes/compiler-minecraft'))
    compiler.addTypes(require('prismarine-nbt/compiler-zigzag'))

    fs.writeFileSync('../read.js', 'module.exports = ' + compiler.readCompiler.generate())
    fs.writeFileSync('../write.js', 'module.exports = ' + compiler.writeCompiler.generate())
    fs.writeFileSync('../size.js', 'module.exports = ' + compiler.sizeOfCompiler.generate())

    const compiledProto = compiler.compileProtoDefSync()
    return compiledProto
}

console.log('Generating JS...')
createProtocol()