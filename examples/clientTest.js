process.env.DEBUG = 'minecraft-protocol raknet'
const { Client } = require('bedrock-protocol')

async function test () {
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

    client.queue('client_cache_status', { enabled: false })
    client.queue('request_chunk_radius', { chunk_radius: 1 })
    client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: 0n })
  })

  // var read = 0;
  // client.on('level_chunk', (packet) => {
  //   read++
  //   fs.writeFileSync(`level_chunk-${read}.json`, JSON.stringify(packet, null, 2))
  // })
}

test()
