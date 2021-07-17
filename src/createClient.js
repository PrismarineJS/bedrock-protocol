const { Client } = require('./client')
const { RakClient } = require('./rak')(true)
const assert = require('assert')
const advertisement = require('./server/advertisement')
const { sleep } = require('./datatypes/util')

/** @param {{ version?: number, host: string, port?: number, connectTimeout?: number, skipPing?: boolean }} options */
function createClient (options) {
  assert(options)
  const client = new Client({ port: 19132, ...options })

  if (options.skipPing) {
    connect(client)
  } else { // Try to ping
    client.ping().then(data => {
      const advert = advertisement.fromServerName(data)
      console.log(`Connecting to server ${advert.motd} (${advert.name}), version ${advert.version}`)
      client.version = options.version ?? advert.version
      connect(client)
    }, client)
  }

  return client
}

function connect (client) {
  // Actually connect
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
    client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: 0n })
    sleep(500).then(() => client.queue('request_chunk_radius', { chunk_radius: client.viewDistance || 10 }))
  })

  const KEEPALIVE_INTERVAL = 10 // Send tick sync packets every 10 ticks
  let keepalive
  client.tick = 0n
  client.once('spawn', () => {
    keepalive = setInterval(() => {
      // Client fills out the request_time and the server does response_time in its reply.
      client.queue('tick_sync', { request_time: client.tick, response_time: 0n })
      client.tick += BigInt(KEEPALIVE_INTERVAL)
    }, 50 * KEEPALIVE_INTERVAL)

    client.on('tick_sync', async packet => {
      client.emit('heartbeat', packet.response_time)
      client.tick = packet.response_time
    })
  })

  client.once('close', () => {
    clearInterval(keepalive)
  })
}

async function ping ({ host, port }) {
  const con = new RakClient({ host, port })
  const ret = await con.ping()
  con.close()
  return advertisement.fromServerName(ret)
}

module.exports = { createClient, ping }
