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
  name: 'MCPE;Minecraft: PE Server;81 81;0.15.0;0;20'
});

server.on('connection', function(client) {


  client.on("mcpe",packet => console.log(packet));

  client.on("login_mcpe",packet => {
    client.writeMCPE("player_status",{
      status:0
    });

    client.writeMCPE('move_player', {
      entityId: [0,0],
      x: 1,
      y: 64 + 1.62,
      z: 1,
      yaw: 0,
      headYaw: 0,
      pitch: 0,
      mode: 0,
      onGround: 1
    });

    client.writeMCPE("start_game",{
      seed:-1,
      dimension:0,
      generator:1,
      gamemode:1,
      entityId:[0,0],
      spawnX:1,
      spawnY:1,
      spawnZ:1,
      x:0,
      y:1+1.62,
      z:0,
      isLoadedInCreative:0,
      dayCycleStopTime:0,
      eduMode:0,
      worldName:""
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

  client.on("chunk_radius_update",() => {
    client.writeMCPE('chunk_radius_update',{
      chunk_radius:1
    });

    for (let x = -1; x <=1; x++) {
      for (let z = -1; z <=1; z++) {
        client.writeBatch([{name:"full_chunk_data",params:{
          chunkX: x,
          chunkZ: z,
          order: 1,
          chunkData:fs.readFileSync(__dirname+"/chunk")
        }}]);
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
