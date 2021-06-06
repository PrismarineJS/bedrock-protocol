const fs = require('fs')
const { Versions } = require('../src/options')
const { join } = require('path')
const { parse, genHTML } = require('protodef-yaml')

let inputFile, includeComments

const ci = process.env.GITHUB_ACTIONS || process.argv[3]

function createDocs() {
  fs.writeFileSync('packet_map.yml', '!import: types.yaml')
  const inter = parse(inputFile = 'proto.yml', includeComments = true)
  const html = genHTML(inter, { includeHeader: true })
  if (ci) {
    const version = inter['!version']
    fs.writeFileSync(`../${version}.html`, html)
  }

  fs.unlinkSync('packet_map.yml')
}

function main(ver = 'latest') {
  process.chdir(join(__dirname, '/../data/', ver))
  console.log('p', process.cwd())
  if (!fs.existsSync('./proto.yml')) return
  console.log('Generating JS...', ver)
  createDocs(ver)
}

main(process.argv[2])
