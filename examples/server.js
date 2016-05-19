'use strict';

var pmp = require('../');
var fs = require("fs");

if(process.argv.length !=4) {
  console.log("Usage: node server.js <host> <port>");
  process.exit(1);
}

var server = pmp.createServer({
  host: process.argv[2],
  port: parseInt(process.argv[3]),
  name: 'MCPE;Minecraft: PE Server;70 70;0.14.3;0;20'
});

server.on('connection', function(client) {


  client.on("mcpe",packet => console.log(packet));

  client.on("game_login",packet => {
    client.writeMCPE("player_status",{
      status:0
    });
    client.writeMCPE('move_player', {
      entity_id: [0,0],
      x: 1,
      y: 64 + 1.62,
      z: 1,
      yaw: 0,
      head_yaw: 0,
      pitch: 0,
      mode: 0,
      on_ground: 1
    });

    client.writeMCPE("start_game",{
      seed:-1,
      dimension:0,
      generator:1,
      gamemode:1,
      entity_id:[0,0],
      spawn_x:1,
      spawn_y:1,
      spawn_z:1,
      x:0,
      y:1+1.62,
      z:0,
      unknown1:0,
      unknown2:0,
      unknown3:0,
      unknown4:""
    });

    client.writeMCPE('set_spawn_position', {
      x: 1,
      y: 64,
      z: 1
    });
    client.writeMCPE("set_time",{
      time:0,
      started:1
    });

    client.writeMCPE('respawn', {
      x: 1,
      y: 64,
      z: 1
    });
  });

  client.on("request_chunk_radius",() => {
    client.writeMCPE('chunk_radius_update',{
      chunk_radius:1
    });

    for (let x = -1; x <=1; x++) {
      for (let z = -1; z <=1; z++) {
        client.writeBatch([{"name":"mcpe","params":{name:"full_chunk_data",params:{
        chunk_x: x,
        chunk_z: z,
        order: 1,
        chunk_data:fs.readFileSync(__dirname+"/chunk")
        }}}]);
      }
    }

    client.writeMCPE('player_status', {
      status: 3
    });

    client.writeMCPE('set_time', {
      time: 0,
      started: 1
    });

  });

  client.on('error', function(err) {
    console.log(err.stack);
  });

  client.on('end',function() {
    console.log("client left");
  })
});
