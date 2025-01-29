const { Client } = require('./client')
const { RakClient } = require('./rak')('raknet-native')
const { sleep } = require('./datatypes/util')
const assert = require('assert')
const Options = require('./options')
const advertisement = require('./server/advertisement')
const auth = require('./client/auth')
const { NethernetClient } = require('./nethernet')
const { NethernetSignal } = require('./websocket/signal')

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
        if (client.options.transport === 'raknet') {
          const adVersion = ad.version?.split('.').slice(0, 3).join('.') // Only 3 version units
          client.options.version = options.version ?? (Options.Versions[adVersion] ? adVersion : Options.CURRENT_VERSION)

          if (ad.portV4 && client.options.followPort) {
            client.options.port = ad.portV4
          }

          client.conLog?.(`Connecting to ${client.options.host}:${client.options.port} ${ad.motd} (${ad.levelName}), version ${ad.version} ${client.options.version !== ad.version ? ` (as ${client.options.version})` : ''}`)
        } else if (client.options.transport === 'nethernet') {
          client.conLog?.(`Connecting to ${client.options.networkId} ${ad.motd} (${ad.levelName})`)
        }

        client.init()
      }).catch(e => {
        if (!client.options.useSignalling) {
          client.emit('error', e)
        } else {
          client.conLog?.('Could not ping server through local signalling, trying to connect over franchise signalling instead')
          client.init()
        }
      })
    }
  }

  if (options.world) {
    auth.worldAuthenticate(client, client.options).then(onServerInfo).catch(e => client.emit('error', e))
  } else if (options.realms) {
    auth.realmAuthenticate(client.options).then(onServerInfo).catch(e => client.emit('error', e))
  } else {
    onServerInfo()
  }
  return client
}

/** @param {Client} client */
async function connect (client) {
  if (client.options.useSignalling) {
    client.signalling = new NethernetSignal(client.connection.nethernet.networkId, client.options.authflow)

    await client.signalling.connect(client.options.version)

    client.connection.nethernet.credentials = client.signalling.credentials
    client.connection.nethernet.signalHandler = client.signalling.write.bind(client.signalling)

    client.signalling.on('signal', signal => client.connection.nethernet.handleSignal(signal))
  }

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

    if (client.versionLessThanOrEqualTo('1.20.80')) client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: 0n })

    sleep(500).then(() => client.queue('request_chunk_radius', { chunk_radius: client.viewDistance || 10 }))
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

  client.once('close', () => {
    if (client.session) client.session.end()
    if (client.signalling) client.signalling.destroy()
  })
}

async function ping ({ host, port, networkId }) {
  console.log('Pinging', host, port, networkId)
  if (networkId) {
    const con = new NethernetClient({ networkId })
    try {
      return advertisement.NethernetServerAdvertisement.fromBuffer(await con.ping())
    } finally {
      con.close()
    }
  } else {
    const con = new RakClient({ host, port })
    try {
      return advertisement.fromServerName(await con.ping())
    } finally {
      con.close()
    }
  }
}

module.exports = { createClient, ping }
