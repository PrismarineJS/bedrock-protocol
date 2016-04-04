'use strict';
const assert = require('assert');
const raknet = require('raknet');

function createClient(options) {
  assert.ok(options, "options is required");
  var port = options.port || 19132;
  var host = options.host || 'localhost';

  assert.ok(options.username, "username is required");

  options.customPackets=require("../data/protocol");
  options.customTypes=require("./datatypes/minecraft");

  var client=raknet.createClient(options);
  client.username = options.username;
  client.on("mcpe",packet => client.emit(packet.name,packet.params))
  client.writeMCPE=(name,packet) => {
    client.writeEncapsulated("mcpe",{
      name:name,
      params:packet
    });
  };

  return client;
}

module.exports = createClient;