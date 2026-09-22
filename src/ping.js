const initRaknet = require('./rak')
const { NethernetClient } = require('./nethernet')
const { fromServerName } = require('./server/advertisement')

// Without a transport override, use the first readable advertisement from either
// transport. A failed probe must not prevent the other transport from responding.
async function ping (options) {
  const transport = options.transport ?? (options.nethernet ? 'nethernet' : undefined)
  options.signal?.throwIfAborted()
  if (transport != null) {
    if (!['raknet', 'nethernet'].includes(transport)) throw new Error(`Unsupported transport: ${transport}`)
    return probe({ ...options, transport })
  }

  const controller = new AbortController()
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
  try {
    return await Promise.any(['raknet', 'nethernet'].map(transport => probe({ host: '127.0.0.1', ...options, transport, signal, timeout: options.timeout ?? 1000 })))
  } catch (error) {
    options.signal?.throwIfAborted()
    throw new AggregateError(error.errors, 'Neither RakNet nor Nethernet discovery succeeded')
  } finally {
    controller.abort()
  }
}

async function probe ({ host, port = 19132, nethernet, transport, signal, timeout = transport === 'nethernet' ? 10000 : 1000 }) {
  signal?.throwIfAborted()
  let con
  if (transport === 'nethernet') {
    con = new NethernetClient({ host, networkId: nethernet?.networkId, webrtcBackend: nethernet?.webrtcBackend })
  } else {
    const { RakClient } = initRaknet('raknet-native')
    con = new RakClient({ host: host ?? '127.0.0.1', port })
  }
  try {
    const result = await con.ping(timeout, { signal })
    const ad = transport === 'nethernet' ? result : fromServerName(result)
    if (transport === 'raknet' && ad.header !== 'MCPE' && ad.header !== 'MCEE') throw new Error('Not a Bedrock advertisement')
    return Object.assign(ad, { transport })
  } finally {
    con.close()
  }
}

module.exports = ping
