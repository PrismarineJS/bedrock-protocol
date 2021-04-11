// dumps (up to 5 of each) packet encountered until 'spawn' event
// uses the same format as prismarine-packet-dumper
const fs = require('fs')
const vanillaServer = require('../tools/startVanillaServer')
const { Client } = require('../src/client')
const { serialize, waitFor } = require('../src/datatypes/util')
const { CURRENT_VERSION } = require('../src/options')
const path = require('path')

const output = path.resolve('output')

let loop

async function dump (version) {
  const random = ((Math.random() * 100) | 0)
  const port = 19130 + random

  const handle = await vanillaServer.startServerAndWait(version || CURRENT_VERSION, 1000 * 120, { 'server-port': port })

  console.log('Started server')
  const client = new Client({
    hostname: '127.0.0.1',
    port,
    username: 'dumpBot',
    offline: true
  })

  return waitFor(async res => {
    await fs.promises.mkdir(output)
    await fs.promises.mkdir(path.join(output, 'from-server'))

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
    })

    const kindCounter = {}
    const MAX_PACKETS_PER_TYPE = 5
    client.on('packet', async packet => { // Packet dumping
      const { fullBuffer, data: { name, params } } = packet
      if (!packet.data.name) return
      if (!kindCounter[packet.name]) {
        await fs.promises.mkdir(path.join(output, 'from-server', name), { recursive: true })
        kindCounter[name] = 0
      }
      if (kindCounter[name] === MAX_PACKETS_PER_TYPE) return
      kindCounter[name]++

      await fs.promises.writeFile(path.join(output, 'from-server', name, `${kindCounter[name]}.bin`), fullBuffer)

      try {
        fs.writeFileSync(path.join(output, 'from-server', name, `${kindCounter[name]}.json`), serialize(params, 2))
      } catch (e) {
        console.log(e)
      }
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
    handle.kill()
    throw Error('timed out')
  })
}
async function main () {
  if (fs.existsSync(output)) fs.promises.rm(output, { force: true, recursive: true })
  await dump(null, true)
  console.log('Successfully dumped packets')
}

main()
