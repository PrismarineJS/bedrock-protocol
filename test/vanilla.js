// process.env.DEBUG = 'minecraft-protocol raknet'
const vanillaServer = require('../tools/startVanillaServer')
const { Client } = require('../src/client')
const { waitFor } = require('../src/datatypes/util')

async function test () {
  // Start the server, wait for it to accept clients, throws on timeout
  const handle = await vanillaServer.startServerAndWait('1.16.201', 1000 * 20)
  console.log('Started server')

  const client = new Client({
    hostname: '127.0.0.1',
    port: 19130,
    username: 'Notch',
    offline: true
  })

  console.log('Started client')

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

      console.log('Awaiting join')

      client.on('spawn', () => {
        console.log('✔ Client has spawned')
        client.close()
        handle.kill()
        res()
      })
    })
  }, 9100, () => {
    console.log('❌ client timed out')
    client.close()
    handle.kill()
  })
  clearInterval(loop)
}

if (!module.parent) test()
module.exports = { clientTest: test }
