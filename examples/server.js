var pmp = require('../');

if(process.argv.length !=4) {
  console.log("Usage: node server.js <host> <port>");
  process.exit(1);
}

var server = pmp.createServer({
  host: process.argv[2],
  port: parseInt(process.argv[3]),
  name: 'MCPE;numerous-alpaca test server!;45 45;0.0.1;0;20'
});

server.on('connection', function(client) {
  client.on('error', function(err) {
    console.log(err.stack);
  });
});