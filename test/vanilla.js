// process.env.DEBUG = 'minecraft-protocol raknet'
const vanillaServer = require('../tools/startVanillaServer')
const { dumpPackets } = require('../tools/genPacketDumps')
const { getTransport } = require('../tools/vanillaClient')
const { createClient } = require('../src/createClient')
const { once } = require('events')
const { getPort } = require('./util')

// Boot the vanilla server once, then run the spawn test and the packet dump
// (needed by the internal client/server test) against it in parallel with
// two different bots.
async function vanillaTest (version) {
  const protocol = getTransport(version) === 'nethernet' ? 'tcp' : 'udp'
  const [port, v6] = [await getPort(protocol), await getPort(protocol)]
  console.log('Starting vanilla server', version, 'on port', port, v6)
  const handle = await vanillaServer.startServerAndWait2(version, 1000 * 220, { 'server-port': port, 'server-portv6': v6, 'enable-lan-visibility': protocol !== 'tcp' })
  console.log('Started server')
  try {
    await Promise.all([
      clientTest(version, port),
      dumpPackets(version, true, port)
    ])
  } finally {
    handle.kill()
  }
}

async function clientTest (version, port) {
  const client = createClient({
    host: '127.0.0.1',
    port,
    username: 'Notch',
    version,
    offline: true,
    nethernet: getTransport(version) === 'nethernet' ? { signalling: 'http', onServerKey: () => true } : undefined
  })
  try {
    await once(client, 'spawn', { signal: AbortSignal.timeout(60000) })
    console.log('✔ Public client has spawned')
  } finally {
    client.close()
  }
}

module.exports = { vanillaTest, clientTest }
