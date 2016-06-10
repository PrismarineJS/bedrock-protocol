const raknet = require('raknet');
const zlib = require('zlib');
const ProtoDef = require('protodef').ProtoDef;
const batchProto=new ProtoDef();
batchProto.addTypes(require("./datatypes/minecraft"));
batchProto.addType("insideBatch",["endOfArray",{"type":["buffer",{"countType":"i32"}]}]);

function createServer(options) {
  options = options || {};
  var port = options.port != null ?
    options.port :
    options['server-port'] != null ?
    options['server-port'] :
    19132;
  var host = options.host || '0.0.0.0';

  options.customPackets=require('minecraft-data')('pe_0.14').protocol;
  options.customTypes=require("./datatypes/minecraft");
  var server = raknet.createServer(options);

  server.name = options.name || "Minecraft Server";
  server.motd = options.motd || "A Minecraft server";
  server.maxPlayers = options['max-players'] || 20;
  server.playerCount = 0;

  server.on("connection", function (client) {
    client.on("mcpe",packet => client.emit(packet.name,packet.params));

    client.writeMCPE=(name,packet) => {
      client.writeEncapsulated("mcpe",{
        name:name,
        params:packet
      });
    };
    client.writeBatch=function(packets) {
      const payload=zlib.deflateSync(batchProto.createPacketBuffer("insideBatch",
        packets.map(packet =>
          client.encapsulatedPacketSerializer.createPacketBuffer(packet).slice(1))));
      client.writeMCPE("batch",{
        payload:payload
      });
    }
  });
  return server;
}

module.exports = createServer;
