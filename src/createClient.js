const { Client } = require('./client')
const { RakClient } = require('./rak')(true)
const { sleep } = require('./datatypes/util')
const assert = require('assert')
const advertisement = require('./server/advertisement')

/** @param {{ version?: number, host: string, port?: number, connectTimeout?: number, skipPing?: boolean }} options */
function createClient (options) {
  assert(options)
  if (!options.skipPing) options.pingBeforeConnect = true
  const client = new Client({ port: 19132, ...options })
  client.on('connect_allowed', () => connect(client))
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

  // Send tick sync packets every 10 ticks
  const keepAliveInterval = 10
  const keepAliveIntervalBig = BigInt(keepAliveInterval)
  let keepalive
  client.tick = 0n
  client.once('spawn', () => {
    keepalive = setInterval(() => {
      // Client fills out the request_time and the server does response_time in its reply.
      client.queue('tick_sync', { request_time: client.tick, response_time: 0n })
      client.tick += keepAliveIntervalBig
    }, 50 * keepAliveInterval)

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
