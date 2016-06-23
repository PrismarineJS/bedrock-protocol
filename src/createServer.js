'use strict';
const raknet = require('raknet');
const zlib = require('zlib');
const ProtoDef = require('protodef').ProtoDef;
const Parser = require('protodef').Parser;
const Serializer = require('protodef').Serializer;
const jwt = require('jwt-simple');
const crypto = require('crypto');
const Ber = require('asn1').Ber;
const merge=require("lodash.merge");
const assert=require("assert");
var debug = require('debug')("raknet");
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


function writeLI64(value, buffer, offset) {
  buffer.writeInt32LE(value[0], offset+4);
  buffer.writeInt32LE(value[1], offset);
  return offset + 8;
}

function computeCheckSum(packetPlaintext,sendCounter,secretKeyBytes) {
  let digest = crypto.createHash('sha256');
  let counter=new Buffer(8);
  writeLI64(sendCounter,counter,0);
  digest.update(counter);
  digest.update(packetPlaintext);
  digest.update(secretKeyBytes);
  let hash = digest.digest();

  return hash.slice(0,8);
}


function readX509PublicKey(key) {
  var reader = new Ber.Reader(new Buffer(key, "base64"));
  reader.readSequence();
  reader.readSequence();
  reader.readOID();
  reader.readOID();
  return new Buffer(reader.readString(Ber.BitString, true)).slice(1);
}

function writeX509PublicKey(key) {
  var writer = new Ber.Writer();
  writer.startSequence();
  writer.startSequence();
  writer.writeOID("1.2.840.10045.2.1");
  writer.writeOID("1.3.132.0.34");
  writer.endSequence();
  writer.writeBuffer(Buffer.concat([new Buffer([0x00]),key]),Ber.BitString);
  writer.endSequence();
  return writer.buffer.toString("base64");
}

const Transform = require('stream').Transform;


const PUBLIC_KEY = 'MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE8ELkixyLcwlZryUQcu1TvPOmI2B7vX83ndnWRUaXm74wFfa5f/lwQNTfrLVHa2PmenpGI6JhIMUJaWZrjmMj90NoKNFSNBuKdm8rYiXsfaz3K36x/1U26HpG0ZxK/V1V';

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

    client.receiveCounter=0;
    client.sendCounter=0;

    client.encryptionEnabled = false;

    client.on("mcpe", packet => {
      client.emit(packet.name, packet.params)
    });


    client.on("game_login", packet => {
      var body = packet.body;
      var body2 = zlib.inflateSync(body);
      var parsed = dataProto.parsePacketBuffer("data_chain", body2);
      parsed.data.chain = JSON.parse(parsed.data.chain);

      var clientData = parsed.data.clientData;
      var chain1 = parsed.data.chain.chain[0];
      var chain2 = parsed.data.chain.chain[1];

      var decode1 = jwt.decode(chain1, PUBLIC_KEY, 'ES384');
      var nextKey1 = decode1.identityPublicKey;

      var clientDecode = jwt.decode(clientData, nextKey1, 'ES384');
      client.randomId = clientDecode.ClientRandomId;
      client.skinData = clientDecode.SkinData;
      client.skinId = clientDecode.SkinId;

      var ec = crypto.createECDH('secp384r1');
      ec.generateKeys();

      client.secretKeyBytes = crypto.createHash('sha256');
      client.secretKeyBytes.update("SO SECRET VERY SECURE");;
      client.secretKeyBytes = client.secretKeyBytes.digest();

      let pubKeyServer=writeX509PublicKey(ec.getPublicKey());
      client.writeMCPE('server_to_client_handshake', {
        publicKey: pubKeyServer,
        serverToken: "SO SECRET VERY SECURE" // obviously, this is super secure (it's not, change it)
      });
      var decipher = crypto.createDecipheriv('aes-256-cfb8', client.secretKeyBytes, client.secretKeyBytes.slice(0,16));
      let customPackets=JSON.parse(JSON.stringify(require("../data/protocol")));
      customPackets['types']['encapsulated_packet'][1][1]['type'][1]['fields']['mcpe_encrypted'] = 'restBuffer';
      customPackets['types']['encapsulated_packet'][1][0]['type'][1]['mappings']['0xfe'] = 'mcpe_encrypted';
      client.encapsulatedPacketParser.proto.addTypes(merge(require('raknet').protocol, customPackets).types);
      client.encryptionEnabled = true;

      client.on("mcpe_encrypted", packet => {
        decipher.write(packet);
      });

      client.cipher=crypto.createCipheriv('aes-256-cfb8', client.secretKeyBytes, client.secretKeyBytes.slice(0,16));


      const checksumTransform = new Transform({
        transform(chunk,enc,cb) {
          const packet=chunk.slice(0,chunk.length-8);
          const checksum=chunk.slice(chunk.length-8);
          const computedCheckSum=computeCheckSum(packet,[0,client.receiveCounter],client.secretKeyBytes);
          assert.equal(checksum.toString("hex"),computedCheckSum.toString("hex"));
          client.receiveCounter++;
          if(checksum.toString("hex")==computedCheckSum.toString("hex")) this.push(packet);
          cb();
        }
      });
      client.addChecksumTransform = new Transform({
        transform(chunk,enc,cb) {
          const packet=Buffer.concat([chunk,computeCheckSum(chunk,[0,client.sendCounter],client.secretKeyBytes)]);
          client.sendCounter++;
          this.push(packet);
          cb();
        }
      });


      decipher.pipe(checksumTransform);
      const proto=new ProtoDef();
      proto.addTypes(require("./datatypes/minecraft"));
      proto.addTypes(require("../data/protocol").types);
      client.mcpePacketParser=new Parser(proto,"mcpe_packet");
      client.mcpePacketSerializer=new Serializer(proto,"mcpe_packet");
      checksumTransform.pipe(client.mcpePacketParser);
      client.mcpePacketParser.on("data",parsed => {if(parsed.data.name=="batch") parsed.data.name="batch_non_encrypted"; return client.emitPacket(parsed)});


      client.mcpePacketSerializer.pipe(client.addChecksumTransform);
      client.addChecksumTransform.pipe(client.cipher);

      client.cipher.on('data', data => client.writeEncapsulated("mcpe_encrypted", data));
    });

    client.writeMCPE = (name, params) => {
      if(client.encryptionEnabled) {
        debug("write mcpe",name,params);
        client.mcpePacketSerializer.write({ name, params });
      }
      else {
        client.writeEncapsulated("mcpe", { name, params });
      }
    };

    client.writeBatch = function(packets) {
        const payload = zlib.deflateSync(batchProto.createPacketBuffer("insideBatch",
          packets.map(packet =>
            client.mcpePacketSerializer.createPacketBuffer(packet))));

        client.writeMCPE("batch", {
          payload: payload
        });
    };

    client.on('batch', function(packet) {
      var buf = zlib.inflateSync(packet.payload);
      var packets = batchProto.parsePacketBuffer("insideBatch", buf).data;
      packets.forEach(packet => client.readEncapsulatedPacket(Buffer.concat([new Buffer([0xfe]), packet])));
    });

    client.on('client_to_server_handshake',() => {
      client.emit('login_mcpe', {
        displayName: client.displayName,
        randomId: client.randomId,
        skinData: client.skinData,
        skinId: client.skinId,
        identity: client.identity,
        XUID: client.XUID
      });
    });


    client.on('batch_non_encrypted', function(packet) {
      var buf = zlib.inflateSync(packet.payload);
      var packets = batchProto.parsePacketBuffer("insideBatch", buf).data;
      packets.forEach(packet => {
        try {
          debug("handle mcpe",packet);
          var r = client.mcpePacketParser.parsePacketBuffer(packet);
          client.emitPacket(r);
        }
        catch(err) {
          client.emit("error",err);
        }
      });
    });
  });
  return server;
}

module.exports = createServer;
