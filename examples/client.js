'use strict';
var pmp = require('../');

if(process.argv.length !=5) {
  console.log("Usage: node client.js <host> <port> <username>");
  process.exit(1);
}

var client = pmp.createClient({
  host: process.argv[2],
  port: parseInt(process.argv[3]),
  username:process.argv[4]
});

client.on('mcpe', packet => console.log(packet));

client.on('set_spawn_position', () => {
  client.writeMCPE('request_chunk_radius', {
    chunkRadius:8
  });
});

client.on('error',function(err){
  console.log(err);
});
