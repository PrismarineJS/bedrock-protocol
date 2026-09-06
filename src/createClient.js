const { Client } = require('./client')
const { RakClient } = require('./rak')('raknet-native')
const { sleep } = require('./datatypes/util')
const assert = require('assert')
const Options = require('./options')
const advertisement = require('./server/advertisement')
const auth = require('./client/auth')

/** @param {{ version?: number, host: string, port?: number, connectTimeout?: number, skipPing?: boolean }} options */
function createClient (options) {
  assert(options)
  const client = new Client({ port: 19132, followPort: !options.realms, ...options, delayedInit: true })

  function onServerInfo () {
    client.on('connect_allowed', () => connect(client))
    if (options.skipPing) {
      client.init()
    } else {
      ping(client.options).then(ad => {
        const adVersion = ad.version?.split('.').slice(0, 3).join('.') // Only 3 version units
        client.options.version = options.version ?? (Options.Versions[adVersion] ? adVersion : Options.CURRENT_VERSION)

        if (ad.portV4 && client.options.followPort) {
          client.options.port = ad.portV4
        }

        client.conLog?.(`Connecting to ${client.options.host}:${client.options.port} ${ad.motd} (${ad.levelName}), version ${ad.version} ${client.options.version !== ad.version ? ` (as ${client.options.version})` : ''}`)
        client.init()
      }).catch(e => client.emit('error', e))
    }
  }

  if (options.realms) {
    auth.realmAuthenticate(client.options).then(onServerInfo).catch(e => client.emit('error', e))
  } else {
    onServerInfo()
  }
  return client
}

function connect (client) {
  // Actually connect
  client.connect()

  // Echo network_stack_latency back so latency-tracking servers see the client as responsive (#643).
  client.on('network_stack_latency', (packet) => {
    if (packet.needs_response) {
      client.queue('network_stack_latency', { timestamp: packet.timestamp, needs_response: false })
    }
  })

  client.once('resource_packs_info', (packet) => {
    // As of 1.26.40 the status is a varint followed by the same status as a lowercase string.
    // Older protocol versions have no such field and simply ignore it.
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

    if (client.versionLessThanOrEqualTo('1.20.80')) client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: 0n })

    if (client.options.version === '1.16.201') {
      client.queue('request_chunk_radius', { chunk_radius: 1 })
      client.once('spawn', () => client.queue('request_chunk_radius', { chunk_radius: client.viewDistance || 10 }))
    } else {
      sleep(500).then(() => client.queue('request_chunk_radius', { chunk_radius: client.viewDistance || 10 }))
    }
  })

  if (client.versionLessThanOrEqualTo('1.20.80')) {
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
}

async function ping ({ host, port }) {
  const con = new RakClient({ host, port })

  try {
    return advertisement.fromServerName(await con.ping())
  } finally {
    con.close()
  }
}

module.exports = { createClient, ping }
