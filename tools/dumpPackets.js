// dumps (up to 5 of each) packet encountered until 'spawn' event
// uses the same format as prismarine-packet-dumper
const assert = require('assert')
const fs = require('fs')
const vanillaServer = require('../tools/startVanillaServer')
const { Client } = require('../src/client')
const { serialize, waitFor } = require('../src/datatypes/util')
const { CURRENT_VERSION } = require('../src/options')
const path = require('path')

const output = path.resolve(process.argv[3] ?? 'output')

let loop

async function dump (version) {
  const random = ((Math.random() * 100) | 0)
  const port = 19130 + random

  const handle = await vanillaServer.startServerAndWait(version || CURRENT_VERSION, 1000 * 120, { 'server-port': port })

  console.log('Started server')
  const client = new Client({
    host: '127.0.0.1',
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
      res(kindCounter)
    })
  }, 1000 * 60, () => {
    clearInterval(loop)
    handle.kill()
    throw Error('timed out')
  })
}

const makeDropdownStart = (name, arr) => {
  arr.push(`<details><summary>${name}</summary>`)
  arr.push('<p>')
  arr.push('')
}
const makeDropdownEnd = (arr) => {
  arr.push('')
  arr.push('</p>')
  arr.push('</details>')
}

function makeMarkdown (data) {
  const str = []
  const { collected, missing } = data

  makeDropdownStart(`Collected (${collected.length})`, str)
  str.push('| Packet |')
  str.push('| --- |')
  collected.forEach(elem => {
    str.push(`| ${elem} |`)
  })
  makeDropdownEnd(str)

  makeDropdownStart(`Missing (${missing.length})`, str)
  str.push('| Packet |')
  str.push('| --- |')
  missing.forEach(elem => {
    str.push(`| ${elem} |`)
  })
  makeDropdownEnd(str)

  return str.join('\n')
}

function parsePacketCounter (version, kindCounter) {
  const protocol = require(`../data/${version}/protocol.json`)
  // record packets
  return {
    collectedPackets: Object.keys(kindCounter),
    allPackets: Object.keys(protocol)
      .filter(o => o.startsWith('packet_'))
      .map(o => o.replace('packet_', ''))
  }
}

async function makeStats (kindCounter, version) {
  const { collectedPackets, allPackets } = parsePacketCounter(version, kindCounter)
  // write packet data
  const data = {
    collected: collectedPackets,
    missing: allPackets.filter(o => !collectedPackets.includes(o))
  }
  const metadataFolder = path.join(output, 'metadata')

  await fs.promises.writeFile(path.join(output, 'README.md'), makeMarkdown(data))
  await fs.promises.mkdir(metadataFolder)
  await fs.promises.writeFile(path.join(metadataFolder, 'packets_info.json'), JSON.stringify(data, null, 2))
}

async function main () {
  const version = process.argv[2]
  if (!version) {
    console.error('Usage: node dumpPackets.js <version> [outputPath]')
  }
  const vers = Object.keys(require('../src/options').Versions)
  assert(vers.includes(version), 'Version not supported')
  if (fs.existsSync(output)) fs.promises.rm(output, { force: true, recursive: true })
  const kindCounter = await dump(version)
  await fs.promises.rm(path.join(output, '..', `bds-${version}`), { recursive: true })
  await makeStats(kindCounter, version)
  console.log('Successfully dumped packets')
}

main()
