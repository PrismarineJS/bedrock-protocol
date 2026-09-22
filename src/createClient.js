const { Client } = require('./client')
const assert = require('assert')
const Options = require('./options')
const auth = require('./client/auth')
const ping = require('./ping')
const connect = require('./client/game')

/** @param {{ version?: string, host: string, port?: number, connectTimeout?: number, skipPing?: boolean }} options */
function createClient (options) {
  assert(options)
  const transport = options.transport ?? (options.nethernet ? 'nethernet' : undefined)
  assert(transport == null || ['raknet', 'nethernet'].includes(transport), `Unsupported transport: ${transport}`)
  const host = transport === 'nethernet' ? '255.255.255.255' : '127.0.0.1'
  const client = new Client({ host, port: 19132, followPort: !options.realms, ...options, transport: transport ?? 'raknet', delayedInit: true })

  async function onServerInfo () {
    if (client._closed) return
    client.once('connect_allowed', () => connect(client))
    try {
      const canPing = !client.options.skipPing && !(client.options.transport === 'nethernet' && client.options.nethernet.signalling === 'services')
      let ad
      if (canPing) {
        const resolvedTransport = options.realms || options.world ? client.options.transport : transport
        client._discoveryAbort = new AbortController()
        try {
          ad = await ping({
            ...client.options,
            // Realms/world lookup supplies a transport; direct connections discover both.
            transport: resolvedTransport,
            nethernet: resolvedTransport === 'nethernet' ? client.options.nethernet : undefined,
            timeout: client.options.pingTimeout,
            signal: client._discoveryAbort.signal
          })
        } catch (error) {
          if (client._closed) return
          client.conLog?.(`Server discovery failed (${error.message}); connecting over ${client.options.transport} as ${options.version ?? Options.CURRENT_VERSION}`)
        } finally {
          delete client._discoveryAbort
        }
      }
      if (client._closed) return
      applyAdvertisement(client.options, ad, options.version, client.conLog)
      client.init()
    } catch (error) {
      if (!client._closed) client.onConnectionError(error)
    }
  }

  if (options.world) {
    auth.worldAuthenticate(client, client.options).then(onServerInfo).catch(e => client.onConnectionError(e))
  } else if (options.realms) {
    auth.realmAuthenticate(client.options).then(onServerInfo).catch(e => client.onConnectionError(e))
  } else {
    onServerInfo()
  }
  return client
}

function applyAdvertisement (options, ad, explicitVersion, conLog) {
  if (ad) {
    options.transport = ad.transport
    if (ad.transport === 'nethernet') options.nethernet.networkId = ad.networkId ?? options.nethernet.networkId
  }
  const gameVersion = options.transport === 'nethernet' ? ad?.gameVersion : ad?.version
  // Nethernet v4 carries neither protocol nor game version; ignore constructor defaults.
  const protocol = options.transport !== 'nethernet' || ad?.version === 7 ? ad?.protocol : undefined
  let version = explicitVersion
  if (version == null && protocol != null && protocol !== '') {
    version = Object.keys(Options.Versions).find(version => Options.Versions[version] === Number(protocol))
    if (!version) throw new Error(`Unsupported server protocol ${protocol} (advertised version ${gameVersion ?? 'unknown'}): no minecraft-data support`)
  }
  options.version = version ?? Options.CURRENT_VERSION
  if (ad && options.transport === 'raknet') {
    if (ad.portV4 && options.followPort) options.port = ad.portV4
    conLog?.(`Connecting to ${options.host}:${options.port} ${ad.motd} (${ad.levelName}), version ${gameVersion}${options.version !== gameVersion ? ` (as ${options.version})` : ''}`)
  } else if (ad && options.transport === 'nethernet') {
    conLog?.(`Connecting to ${options.nethernet.networkId} ${ad.motd} (${ad.levelName})`)
  }
}

module.exports = { createClient, ping }
