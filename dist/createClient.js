'use strict';

var assert = require('assert');

var raknet = require('raknet');

var fs = require('fs');

var path = require('path');

var zlib = require('zlib');

var ProtoDef = require('protodef').ProtoDef;

var batchProto = new ProtoDef();
batchProto.addTypes(require("./datatypes/minecraft"));
batchProto.addType("insideBatch", ["endOfArray", {
  "type": ["buffer", {
    "countType": "i32"
  }]
}]);

function createClient(options) {
  return null; //FIXME

  assert.ok(options, 'options is required');
  var port = options.port || 19132;
  var host = options.host || 'localhost';
  assert.ok(options.username, 'username is required');
  options.customPackets = require('../data/protocol');
  options.customTypes = require('./datatypes/minecraft');
  var client = raknet.createClient(options);
  client.username = options.username;
  client.on('mcpe', function (packet) {
    return client.emit(packet.name, packet.params);
  });

  client.writeMCPE = function (name, packet) {
    client.writeEncapsulated('mcpe', {
      name: name,
      params: packet
    });
  };

  client.on('login', function () {
    client.writeMCPE('game_login', {
      username: client.username,
      protocol: 70,
      protocol2: 70,
      clientId: [-1, -697896776],
      clientUuid: '86372ed8-d055-b23a-9171-5e3ac594d766',
      serverAddress: client.host + ":" + client.port,
      clientSecret: new Buffer('e8 88 db 7b 9f f2 f0 44 a3 51 08 18 4e 8c 7f 9a'.replace(/ /g, ''), 'hex'),
      skin: {
        skinType: 'Standard_Steve',
        texture: fs.readFileSync(path.join(__dirname, 'texture'))
      }
    });
  });
  client.on('batch', function (packet) {
    var buf = zlib.inflateSync(packet.payload);
    var packets = batchProto.parsePacketBuffer("insideBatch", buf).data;
    packets.forEach(function (packet) {
      return client.readEncapsulatedPacket(Buffer.concat([new Buffer([0xfe]), packet]));
    });
  });
  return client;
}

module.exports = createClient;