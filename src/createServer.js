const raknet = require('raknet');

function createServer(options) {
  options = options || {};
  var port = options.port != null ?
    options.port :
    options['server-port'] != null ?
    options['server-port'] :
    19132;
  var host = options.host || '0.0.0.0';

  options.customPackets=require("../data/protocol");
  options.customTypes=require("./datatypes/minecraft");
  var server = raknet.createServer(options);

  server.name = options.name || "Minecraft Server";
  server.motd = options.motd || "A Minecraft server";
  server.maxPlayers = options['max-players'] || 20;
  server.playerCount = 0;

  server.on("connection", function (client) {
    client.on("mcpe",packet => client.emit(packet.name,packet.params))


  });
  return server;
}

module.exports = createServer;
