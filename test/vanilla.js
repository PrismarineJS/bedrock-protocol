// process.env.DEBUG = 'minecraft-protocol raknet'
const vanillaServer = require('../tools/startVanillaServer')
const { Client } = require('../src/client')
const { waitFor } = require('../src/datatypes/util')
const { ChunkColumn, Version } = require('bedrock-provider')
const { CURRENT_VERSION } = require('../src/options')

async function test (version) {
  // Start the server, wait for it to accept clients, throws on timeout
  const handle = await vanillaServer.startServerAndWait(version, 1000 * 220)
  console.log('Started server')

  const client = new Client({
    host: '127.0.0.1',
    port: 19130,
    username: 'Notch',
    version,
    offline: true
  })

  console.log('Started client')
  client.connect()

  let loop

  await waitFor((res) => {
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

      clearInterval(loop)
      loop = setInterval(() => {
        client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: BigInt(Date.now()) })
      }, 200)

      client.on('level_chunk', async packet => { // Chunk read test
        const cc = new ChunkColumn(Version.v1_4_0, packet.x, packet.z)
        await cc.networkDecodeNoCache(packet.payload, packet.sub_chunk_count)
      })

      console.log('Awaiting join')

      client.on('spawn', () => {
        console.log('✔ Client has spawned')
        client.close()
        handle.kill()
        res()
      })
    })
  }, 1000 * 60, () => {
    client.close()
    handle.kill()
    throw Error('❌ client timed out ')
  })
  clearInterval(loop)
}

if (!module.parent) test(CURRENT_VERSION)
module.exports = { clientTest: test }
