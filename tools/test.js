// process.env.DEBUG = 'minecraft-protocol raknet'
const vanillaServer = require('./startVanillaServer')
const { Client } = require('../src/client')
const { sleep, waitFor } = require('../src/datatypes/util')

async function test () {
  const handle = vanillaServer.startServer('1.16.201')
  console.log('Started server')

  // ... give some time for server to start
  // TODO: return a promise in `handle` so we can wait for the server to start
  await sleep(5000)

  const client = new Client({
    hostname: '127.0.0.1',
    port: 19130
  })

  console.log('Started client')

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

      client.once('resource_packs_info', (packet) => {
        client.write('resource_pack_client_response', {
          response_status: 'completed',
          resourcepackids: []
        })
      })

      client.queue('client_cache_status', { enabled: false })
      client.queue('request_chunk_radius', { chunk_radius: 1 })

      setInterval(() => {
        client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: BigInt(Date.now()) })
      }, 200)

      console.log('Awaiting join')

      client.on('spawn', () => {
        console.log('Spawned')
        client.close()
        handle.kill('SIGKILL')
        res()
        process.exit(1)
      })
    })
  }, 9100, () => {
    console.log('timed out')
    client.close()
    handle.kill('SIGKILL')
    // throw Error('Timed out!')
    process.exit(1)
  })
}

test()
