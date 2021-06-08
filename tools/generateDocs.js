const fs = require('fs')
const { join } = require('path')
const { parse, genHTML } = require('protodef-yaml')

function createDocs () {
  fs.writeFileSync('packet_map.yml', '!import: types.yaml')
  const inter = parse('proto.yml', true, true)
  const version = inter['!version']
  const html = genHTML(inter, { includeHeader: true })
  fs.writeFileSync(`../${version}/index.html`, html)
  fs.unlinkSync('packet_map.yml')
}

function main (ver = 'latest') {
  process.chdir(join(__dirname, '/../data/', ver))
  if (!fs.existsSync('./proto.yml')) return
  console.log('Generating JS...', ver)
  createDocs(ver)
}

main(process.argv[2])
