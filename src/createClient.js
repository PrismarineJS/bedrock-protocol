const { Client } = require('./client')
const { sleep } = require('./datatypes/util')
const assert = require('assert')
const Options = require('./options')
const advertisement = require('./server/advertisement')
const auth = require('./client/auth')

/** @param {{ version?: number, host: string, port?: number, connectTimeout?: number, skipPing?: boolean }} options */
function createClient (options) {
  assert(options)
  const client = new Client({ port: 19132, ...options, delayedInit: true })

  function onServerInfo () {
    client.on('connect_allowed', () => connect(client))
    if (options.skipPing) {
      client.init()
    } else {
      ping(client.options).then(ad => {
        const adVersion = ad.version?.split('.').slice(0, 3).join('.') // Only 3 version units
        client.options.version = options.version ?? (Options.Versions[adVersion] ? adVersion : Options.CURRENT_VERSION)
        client.conLog?.(`Connecting to server ${ad.motd} (${ad.name}), version ${ad.version}`, client.options.version !== ad.version ? ` (as ${client.options.version})` : '')
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

async function ping ({ host, port, raknetBackend }) {
  var RaknetClient
  console.log('backend : ' + raknetBackend + ' ping : ' + host + ':' + port)
  if (raknetBackend === 'raknet-node') {
    RaknetClient = require('./rak')('raknet-node').RakClient
  } else {
    RaknetClient = require('./rak')('raknet-native').RakClient
  }
  const con = new RaknetClient({ host, port })
  try {
    return advertisement.fromServerName(await con.ping())
  } finally {
    con.close()
  }
}

module.exports = { createClient, ping }
