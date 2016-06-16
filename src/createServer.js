'use strict';
const raknet = require('raknet');
const zlib = require('zlib');
const ProtoDef = require('protodef').ProtoDef;
const jwt = require('jwt-simple');
const crypto = require('crypto');
const Ber = require('asn1').Ber;
// const BN = require('bn.js');

const batchProto = new ProtoDef();
batchProto.addTypes(require("./datatypes/minecraft"));
batchProto.addType("insideBatch", ["endOfArray", {
  "type": ["buffer", {
    "countType": "i32"
  }]
}]);

const dataProto = new ProtoDef();
dataProto.addType("data_chain", ["container", [{
  "name": "chain",
  "type": ["pstring", {
    "countType": "li32"
  }]
}, {
  "name": "clientData",
  "type": ["pstring", {
    "countType": "li32"
  }]
}]]);

const PUBLIC_KEY = 'MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE8ELkixyLcwlZryUQcu1TvPOmI2B7vX83ndnWRUaXm74wFfa5f/lwQNTfrLVHa2PmenpGI6JhIMUJaWZrjmMj90NoKNFSNBuKdm8rYiXsfaz3K36x/1U26HpG0ZxK/V1V';
var encryptionEnabled = false;
var sendCounter = 0;

function createServer(options) {
  options = options || {};
  var port = options.port != null ?
    options.port :
    options['server-port'] != null ?
    options['server-port'] :
    19132;
  var host = options.host || '0.0.0.0';

  options.customPackets = require("../data/protocol");
  options.customTypes = require("./datatypes/minecraft");
  var server = raknet.createServer(options);

  server.name = options.name || "Minecraft Server";
  server.motd = options.motd || "A Minecraft server";
  server.maxPlayers = options['max-players'] || 20;
  server.playerCount = 0;

  server.on("connection", function(client) {
    client.on("mcpe", packet => client.emit(packet.name, packet.params));

    client.on("game_login", packet => {
      var body = packet.body;
      var body2 = zlib.inflateSync(body);
      var parsed = dataProto.parsePacketBuffer("data_chain", body2);
      parsed.data.chain = JSON.parse(parsed.data.chain);

      var clientData = parsed.data.clientData;
      var chain1 = parsed.data.chain.chain[0];
      var chain2 = parsed.data.chain.chain[1].replace('\n', '');

      var decode1 = jwt.decode(chain1, PUBLIC_KEY, 'ES384');
      var nextKey1 = decode1.identityPublicKey;

      var decode2 = jwt.decode(chain2, nextKey1, 'ES384');
      var nextKey2 = decode2.identityPublicKey;

      var clientDecode = jwt.decode(clientData, nextKey1, 'ES384');
      client.randomId = clientDecode.ClientRandomId;
      client.skinData = clientDecode.SkinData;
      client.skinId = clientDecode.SkinId
      client.identity = decode2.extraData.identity;
      client.displayName = decode2.extraData.displayName;
      client.XUID = decode2.extraData.XUID;

      var reader = new Ber.Reader(new Buffer(nextKey2, "base64"));
      reader.readSequence();
      reader.readSequence();
      reader.readOID();
      reader.readOID();
      var pubKey = new Buffer(reader.readString(Ber.BitString, true)).slice(1);
      var ec = crypto.createECDH('secp384r1');
      ec.generateKeys();
      client.sharedSecret = ec.computeSecret(pubKey);

      client.secretKeyBytes = crypto.createHash('sha256').update(client.sharedSecret + "SO SECRET VERY SECURE").digest('binary');
      // console.log(client.secretKeyBytes.length); => 32

      client.writeMCPE('server_to_client_handshake', {
        publicKey: ec.getPublicKey('base64'),
        serverToken: "SO SECRET VERY SECURE" // obviously, this is super secure (it's not, change it)
      });

      encryptionEnabled = true;
      customPackets['types']['encapsulated_packet'][1][1]['type'][1]['fields']['mcpe']='restBuffer'; client.encapsulatedPacketParser.proto.addTypes(merge(require('raknet').protocol,customPackets).types);

      client.emit('login', {
        displayName: client.displayName,
        randomId: client.randomId,
        skinData: client.skinData,
        skinId: client.skinId,
        identity: client.identity,
        XUID: client.XUID
      });
    });

    client.writeMCPE = (name, packet) => {
      if (!encryptionEnabled) {
        client.writeEncapsulated("mcpe", {
          name: name,
          params: packet
        });
      } else {
        sendCounter += 1;
        // sendCounter.add(1);
        // client.writeEncapsulated("mcpe", {
        //   name: name,
        //   params: packet
        // });
      }
    };

    client.writeBatch = function(packets) {
      if (!encryptionEnabled) {
        const payload = zlib.deflateSync(batchProto.createPacketBuffer("insideBatch",
          packets.map(packet =>
            client.encapsulatedPacketSerializer.createPacketBuffer(packet).slice(1))));

        client.writeMCPE("batch", {
          payload: payload
        });
      } else {
        sendCounter += 1;
        // sendCounter.add(1);
        // const payload = zlib.deflateSync(batchProto.createPacketBuffer("insideBatch",
        //   packets.map(packet =>
        //     client.encapsulatedPacketSerializer.createPacketBuffer(packet).slice(1))));
        //
        // client.writeMCPE("batch", {
        //   payload: payload
        // });
      }
    };

    client.on('batch', function(packet) {
      var buf = zlib.inflateSync(packet.payload);
      var packets = batchProto.parsePacketBuffer("insideBatch", buf).data;
      if (!encryptionEnabled) {
        packets.forEach(packet => client.readEncapsulatedPacket(Buffer.concat([new Buffer([0xfe]), packet])));
      } else {
        sendCounter += 1;
        // sendCounter.add(1);
        // packets.forEach(packet => client.readEncapsulatedPacket(Buffer.concat([new Buffer([0xfe]),packet])));
      }
    });
  });
  return server;
}

module.exports = createServer;

// http://stackoverflow.com/questions/19236327/nodejs-sha256-password-encryption
var AES = {};

AES.decrypt = function(cryptkey, iv, encryptdata) {
  encryptdata = new Buffer(encryptdata, 'base64').toString('binary');

  var decipher = crypto.createDecipheriv('aes-256-cbc', cryptkey, iv),
    decoded = decipher.update(encryptdata, 'binary', 'utf8');

  decoded += decipher.final('utf8');
  return decoded;
}

AES.encrypt = function(cryptkey, iv, cleardata) {
  var encipher = crypto.createCipheriv('aes-256-cbc', cryptkey, iv),
    encryptdata = encipher.update(cleardata, 'utf8', 'binary');

  encryptdata += encipher.final('binary');
  encode_encryptdata = new Buffer(encryptdata, 'binary').toString('base64');
  return encode_encryptdata;
}
