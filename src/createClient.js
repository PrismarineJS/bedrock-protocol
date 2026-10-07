const { Client } = require('./client')
const initRaknet = require('./rak')
const { sleep } = require('./datatypes/util')
const assert = require('assert')
const Options = require('./options')
const advertisement = require('./server/advertisement')
const auth = require('./client/auth')
const { NethernetClient } = require('./nethernet')
const { pingHttp } = require('./nethernet/http')

/** @param {{ version?: string, host: string, port?: number, connectTimeout?: number, skipPing?: boolean }} options */
function createClient (options) {
  assert(options)
  const client = new Client({ port: 19132, followPort: !options.realms, ...options, transport: options.transport ?? (options.nethernet ? 'nethernet' : undefined), delayedInit: true })
  const config = client.options

  client.once('connect_allowed', () => connect(client))
  async function start () {
    if (options.world) await auth.worldAuthenticate(client, config)
    else if (options.realms) await auth.realmAuthenticate(config)
    if (client._closed) return
    let ad
    if (!config.skipPing && !(config.transport === 'nethernet' && config.nethernet.signalling === 'services')) {
      client._discoveryAbort = new AbortController()
      try {
        ad = await ping({
          ...config,
          nethernet: config.transport === 'nethernet' ? config.nethernet : undefined,
          timeout: config.pingTimeout,
          signal: client._discoveryAbort.signal
        })
      } catch (error) {
        if (client._closed) return
        client.conLog?.(`Server discovery failed: ${error.message}; using configured defaults`)
      }
    }
    if (client._closed) return
    config.transport = ad?.transport ?? config.transport ?? 'raknet'
    config.version = options.version ?? Options.CURRENT_VERSION
    if (ad) {
      if (ad.signalling === 'http') config.nethernet.signalling = 'http'
      if (ad.networkId != null) config.nethernet.networkId = ad.networkId
      if (ad.portV4 && config.followPort) config.port = ad.portV4
      // Nethernet v4 has no protocol field; its constructor defaults are not server metadata.
      const protocol = ad.transport === 'nethernet' && ad.version === 4 ? undefined : Number(ad.protocol)
      if (options.version == null && protocol) {
        config.version = Object.keys(Options.Versions).find(version => Options.Versions[version] === protocol)
        if (!config.version) throw new Error(`Unsupported server protocol ${protocol}: no minecraft-data support`)
      }
      client.conLog?.(`Connecting over ${config.transport} to ${ad.networkId ?? `${config.host}:${config.port}`} ${ad.motd} (${ad.levelName}), version ${config.version}`)
    }
    client.init()
  }

  start().catch(error => { if (!client._closed) client.onConnectionError(error) })
  return client
}

/** @param {Client} client */
function connect (client) {
  // Actually connect
  client.connect()

  // Echo network_stack_latency back so latency-tracking servers see the client as responsive (#643).
  client.on('network_stack_latency', (packet) => {
    if (packet.needs_response) {
      client.queue('network_stack_latency', { timestamp: packet.timestamp, needs_response: false })
    }
  })

  const completeResourcePacks = () => client.write('resource_pack_client_response', {
    response_status: 'completed',
    // Added in 1.26.40; older serializers ignore this field.
    response_status_name: 'resourcepackstackfinished',
    resourcepackids: []
  })
  client.once('resource_packs_info', () => {
    completeResourcePacks()
    client.once('resource_pack_stack', completeResourcePacks)

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
}

async function ping ({ host, port = 19132, nethernet, transport = nethernet ? 'nethernet' : undefined, signal, timeout = transport === 'nethernet' ? 10000 : 1000 }) {
  if (transport != null && !['raknet', 'nethernet'].includes(transport)) throw new Error(`Unsupported transport: ${transport}`)
  if (transport === 'nethernet' && nethernet?.signalling === 'services') throw new Error('Services signalling does not support server discovery')
  if (transport === 'nethernet' && nethernet?.signalling === 'http') return pingHttp({ host, port, nethernet, timeout, signal })
  const controller = new AbortController()
  signal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  signal.throwIfAborted()
  try {
    return await Promise.any((transport ? [transport] : ['raknet', 'nethernet']).map(async selected => {
      const { RakClient } = initRaknet('raknet-native')
      const con = selected === 'nethernet'
        ? new NethernetClient({ ...nethernet, host: host ?? (transport ? '255.255.255.255' : '127.0.0.1') })
        : new RakClient({ host: host ?? '127.0.0.1', port })
      try {
        const result = await con.ping(timeout, { signal })
        return Object.assign(selected === 'nethernet' ? result : advertisement.fromServerName(result), { transport: selected, ...(selected === 'nethernet' ? { signalling: 'lan' } : {}) })
      } finally {
        con.close()
      }
    }))
  } catch (error) {
    signal.throwIfAborted()
    if (transport === 'raknet' || nethernet?.signalling || nethernet?.networkId != null) throw error.errors[0]
    // Prefer existing UDP connections; HTTP is the fallback when neither responds.
    try {
      return await pingHttp({ host, port, nethernet, timeout, signal })
    } catch (httpError) {
      signal.throwIfAborted()
      throw new AggregateError([...error.errors, httpError], 'Server discovery failed')
    }
  } finally {
    controller.abort()
  }
}

module.exports = { createClient, ping }
