/**
 * Do not use this example unless you need to change the login procedure, instead see `client.js`.
 */
process.env.DEBUG = 'minecraft-protocol raknet'
const { Client } = require('bedrock-protocol')
const ChunkColumn = require('bedrock-provider').chunk('bedrock_1.17.10')

async function test () {
  const client = new Client({
    host: '127.0.0.1',
    port: 19132
    // You can specify version by adding :
    // version: '1.16.210'
  })
  client.connect()

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

    client.queue('client_cache_status', { enabled: false })
    client.queue('request_chunk_radius', { chunk_radius: 1 })
    client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: 0n })
  })

  client.on('level_chunk', async packet => {
    const cc = new ChunkColumn(packet.x, packet.z)
    await cc.networkDecodeNoCache(packet.payload, packet.sub_chunk_count)
    const blocks = []
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        blocks.push(cc.getBlock(x, 0, z)) // Read some blocks in this chunk
      }
    }
  })
}

test()
