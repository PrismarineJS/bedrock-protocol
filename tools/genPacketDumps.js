// Collect sample packets needed for `serverTest.js`
// process.env.DEBUG = 'minecraft-protocol'
const fs = require('fs')
const vanillaServer = require('../tools/startVanillaServer')
const { Client } = require('../src/client')
const { serialize, waitFor, getFiles } = require('../src/datatypes/util')
const { CURRENT_VERSION } = require('../src/options')
const { join } = require('path')
const { getPort } = require('../test/util')

function hasDumps (version) {
  const root = join(__dirname, `../data/${version}/sample/packets/`)
  if (!fs.existsSync(root) || getFiles(root).length < 10) {
    return false
  }
  return true
}

let loop

async function dump (version, force = true) {
  const random = (Math.random() * 1000) | 0
  const [port, v6] = [await getPort(), await getPort()]

  console.log('Starting dump server', version)
  const handle = await vanillaServer.startServerAndWait2(version || CURRENT_VERSION, 1000 * 120, { 'server-port': port, 'server-portv6': v6 })

  console.log('Started dump server', version)
  const client = new Client({
    host: '127.0.0.1',
    port,
    version,
    username: 'Boat' + random,
    offline: true
  })
  client.connect()
  return waitFor(async res => {
    const root = join(__dirname, `../data/${client.options.version}/sample/`)
    if (!fs.existsSync(root + 'packets') || !fs.existsSync(root + 'chunks')) {
      fs.mkdirSync(root + 'packets', { recursive: true })
      fs.mkdirSync(root + 'chunks', { recursive: true })
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

    let i = 0

    client.on('packet', async packet => { // Packet dumping
      const { name, params } = packet.data
      if (name === 'level_chunk') {
        fs.writeFileSync(root + `chunks/${name}-${i++}.bin`, packet.buffer)
        return
      }
      try {
        if (!fs.existsSync(root + `packets/${name}.json`) || force) {
          fs.writeFileSync(root + `packets/${name}.json`, serialize(params, 2))
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
    handle.kill()
    throw Error('timed out')
  })
}

if (!module.parent) {
  dump(null, true).then(() => {
    console.log('Successfully dumped packets')
  })
}
module.exports = { dumpPackets: dump, hasDumps }
