// process.env.DEBUG = 'minecraft-protocol raknet'
const vanillaServer = require('../tools/startVanillaServer')
const { dumpPackets } = require('../tools/genPacketDumps')
const { Client } = require('../src/client')
const { waitFor } = require('../src/datatypes/util')
const { getPort } = require('./util')

// Boot the vanilla server once, then run the spawn test and the packet dump
// (needed by the internal client/server test) against it in parallel with
// two different bots.
async function vanillaTest (version) {
  const [port, v6] = [await getPort(), await getPort()]
  console.log('Starting vanilla server', version, 'on port', port, v6)
  const handle = await vanillaServer.startServerAndWait2(version, 1000 * 220, { 'server-port': port, 'server-portv6': v6 })
  console.log('Started server')
  try {
    await Promise.all([
      clientTest(version, port),
      dumpPackets(version, true, port)
    ])
  } finally {
    handle.kill()
  }
}

async function clientTest (version, port) {
  // const ChunkColumn = require('bedrock-provider').chunk('bedrock_' + (version.includes('1.19') ? '1.18.30' : version)) // TODO: Fix prismarine-chunk

  const client = new Client({
    host: '127.0.0.1',
    port,
    username: 'Notch',
    version,
    raknetBackend: 'raknet-native',
    offline: true
  })

  console.log('Started client')
  client.connect()

  let loop

  await waitFor((res) => {
    client.once('resource_packs_info', (packet) => {
      client.write('resource_pack_client_response', {
        response_status: 'completed',
        response_status_name: 'resourcepackstackfinished',
        resourcepackids: []
      })

      client.once('resource_pack_stack', (stack) => {
        client.write('resource_pack_client_response', {
          response_status: 'completed',
          response_status_name: 'resourcepackstackfinished',
          resourcepackids: []
        })
      })

      client.queue('client_cache_status', { enabled: false })
      client.queue('request_chunk_radius', { chunk_radius: 1 })

      clearInterval(loop)
      loop = setInterval(() => {
        client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: BigInt(Date.now()) })
      }, 200)

      // client.on('level_chunk', async packet => { // Chunk read test
      //   const cc = new ChunkColumn(packet.x, packet.z)
      //   await cc.networkDecodeNoCache(packet.payload, packet.sub_chunk_count)
      // })

      console.log('Awaiting join')

      client.on('spawn', () => {
        console.log('✔ Client has spawned')
        client.close()
        res()
      })
    })
  }, 1000 * 60, () => {
    client.close()
    throw Error('❌ client timed out ')
  })
  clearInterval(loop)
}

module.exports = { vanillaTest, clientTest }
