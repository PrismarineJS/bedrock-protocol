const fs = require('fs')

let compile
try {
    compile = require('protodef-yaml/compiler').compile
} catch (e) {
    require('child_process').execSync('npx protodef-yaml proto.yml protocol.json')
}

if (compile) {
    compile('./proto.yml', 'protocol.json')
}

fs.writeFileSync( '../newproto.json', JSON.stringify({ types: require('./protocol.json') }, null, 2) )
fs.unlinkSync('./protocol.json') //remove temp file