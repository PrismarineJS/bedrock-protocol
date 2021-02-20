// process.env.DEBUG = 'minecraft-protocol raknet'
const { Client } = require('./client')
const fs = require('fs')
// console.log = () => 

async function test() {
  const client = new Client({
    hostname: '127.0.0.1',
    port: 19132
  })

  client.once('resource_packs_info', (packet) => {
    client.write('resource_pack_client_response', {
      response_status: 'completed',
      resourcepackids: []
    })

    client.once('resource_pack_stack', (stack) => {
      client.write('resource_pack_client_response', {
        response_status: 'completed',
        resourcepackids: []
      })
    })

    // client.once('resource_packs_info', (packet) => {
    //   client.write('resource_pack_client_response', {
    //     response_status: 'completed',
    //     resourcepackids: []
    //   })
    // })
  })



  // var read = 0;
  // client.on('level_chunk', (packet) => {
  //   read++
  //   fs.writeFileSync(`level_chunk-${read}.json`, JSON.stringify(packet, null, 2))
  // })
}

test()