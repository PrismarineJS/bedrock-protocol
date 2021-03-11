'use strict'
const mcpe = require('../')
const Parser = require('protodef').Parser

const parser = new Parser(mcpe.createProtocol(), 'mcpe_packet')
// const serializer = mcpe.createSerializer()

parser.write(Buffer.from('9F000000010000007E000000804800B0', 'hex'))

parser.on('error', function (err) {
  console.log(err.stack)
})

parser.on('data', function (chunk) {
  console.log(JSON.stringify(chunk, null, 2))
})
