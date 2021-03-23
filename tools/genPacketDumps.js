/* eslint-disable */
// Collect sample packets needed for `serverTest.js`
// process.env.DEBUG = 'minecraft-protocol'
const fs = require('fs')
const vanillaServer = require('../tools/startVanillaServer')
const { Client } = require('../src/client')
const { serialize, waitFor } = require('../src/datatypes/util')
const { CURRENT_VERSION } = require('../src/options')
const { join } = require('path')

let loop

async function main() {
  const random = ((Math.random() * 100) | 0)
  const port = 19130 + random

  const handle = await vanillaServer.startServerAndWait(CURRENT_VERSION, 1000 * 120, { 'server-port': port, path: 'bds_' })

  console.log('Started server')
  const client = new Client({
    hostname: '127.0.0.1',
    port,
    username: 'Boat' + random,
    offline: true
  })

  return waitFor(async res => {
    const root = join(__dirname, `../data/${client.options.version}/sample/packets/`)
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true })
    }

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
      // client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: 0n })

      clearInterval(loop)
      loop = setInterval(() => {
        client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: BigInt(Date.now()) })
      }, 200)
    })

    client.on('packet', pakData => { // Packet dumping
      if (pakData.name == 'level_chunk') return
      try {
        if (!fs.existsSync(root + `${pakData.name}.json`)) {
          fs.promises.writeFile(root + `${pakData.name}.json`, serialize(pakData.params, 2))
        }
      } catch (e) { console.log(e) }
    })

    console.log('Awaiting join...')

    client.on('spawn', () => {
      console.log('Spawned!')
      clearInterval(loop)
      client.close()
      handle.kill()
      res()
    })
  }, 1000 * 60, () => {
    clearInterval(loop)
    throw Error('timed out')
  })
}

main().then(() => {
  console.log('Successfully dumped packets')
})