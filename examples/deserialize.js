var mcpe = require('../');
var Parser = require('protodef').Parser;

var parser = new Parser(mcpe.createProtocol(),'mcpe_packet');
var serializer = mcpe.createSerializer();

parser.write(new Buffer('b2010000000000000000', 'hex'));

parser.on('error', function(err) {
  console.log(err.stack);
})

parser.on('data', function(chunk) {
  console.log(JSON.stringify(chunk, null, 2));
});
