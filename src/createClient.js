'use strict';
const assert = require('assert');
const raknet = require('raknet');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ProtoDef = require('protodef').ProtoDef;
const batchProto=new ProtoDef();
batchProto.addTypes(require("./datatypes/minecraft"));
batchProto.addType("insideBatch",["endOfArray",{"type":["buffer",{"countType":"i32"}]}]);

function createClient(options) {
  assert.ok(options, 'options is required');
  var port = options.port || 19132;
  var host = options.host || 'localhost';

  assert.ok(options.username, 'username is required');

  options.customPackets=require('minecraft-data')('pe_0.14').protocol;
  options.customTypes=require('./datatypes/minecraft');

  var client=raknet.createClient(options);
  client.username = options.username;
  client.on('mcpe',packet => client.emit(packet.name,packet.params))
  client.writeMCPE=(name,packet) => {
    client.writeEncapsulated('mcpe',{
      name:name,
      params:packet
    });
  };

  client.on('login', function() {
    client.writeMCPE('game_login',
      {
        username: client.username,
        protocol: 70,
        protocol2: 70,
        client_id: [ -1, -697896776 ],
        client_uuid: '86372ed8-d055-b23a-9171-5e3ac594d766',
        server_address: client.host+":"+client.port,
        client_secret: new Buffer('e8 88 db 7b 9f f2 f0 44 a3 51 08 18 4e 8c 7f 9a'.replace(/ /g,''),'hex'),
        skin:
        {
          skinType: 'Standard_Steve',
          texture: fs.readFileSync(path.join(__dirname,'texture'))
        }
      }
    );

  });

  client.on('batch', function(packet) {
    var buf = zlib.inflateSync(packet.payload);
    var packets=batchProto.parsePacketBuffer("insideBatch",buf).data;
    packets.forEach(packet => client.readEncapsulatedPacket(Buffer.concat([new Buffer([0x8e]),packet])));
  });

  return client;
}

module.exports = createClient;
