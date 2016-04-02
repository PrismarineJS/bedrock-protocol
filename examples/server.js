var pmp = require('../');

if(process.argv.length !=4) {
  console.log("Usage: node server.js <host> <port>");
  process.exit(1);
}

var server = pmp.createServer({
  host: process.argv[2],
  port: parseInt(process.argv[3])
});

server.on('connection', function(client) {
  client.on('unconnected_ping', function(packet) {
    console.log(packet);
    client.write('unconnected_pong', {
      pingID: packet.pingID,
      serverID: 0,
      magic: 0,
      serverName: 'MCPE;numerous-alpaca test server!;45 45;0.0.1;0;20'
    });
  });

  client.on('error', function(err) {
    // ignore it
  });
});