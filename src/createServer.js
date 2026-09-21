const { Server } = require('./server')
const assert = require('assert')

const { getRandomUint64 } = require('./datatypes/util')
const { serverAuthenticate } = require('./client/auth')

/** @param {{ port?: number, version?: string, nethernet?: { networkId?: string | bigint, signalling?: string }, transport?: string }} options */
function createServer (options) {
  assert(options)
  const server = new Server({ port: 19132, ...options, nethernet: { networkId: getRandomUint64(), ...options.nethernet } })

  async function start () {
    // Bind before publishing the session or accepting signalling offers.
    await server.listen()
    if (server._closed) return
    if (server.options.transport !== 'nethernet' || server.options.nethernet.signalling !== 'services') return

    const { NethernetSignal } = require('./nethernet/signalling')
    const { SignalType } = require('nethernet')
    await serverAuthenticate(server, server.options)
    if (server._closed) return

    const signalling = new NethernetSignal(server.options.nethernet.networkId, server.options.authflow, server.options.version, {
      timeout: server.options.nethernet.signallingConnectTimeout
    })
    server.nethernet.signalling = signalling
    signalling.on('error', error => server.onConnectionError(error))
    signalling.on('signal', signal => {
      if (server._closed) return
      const transport = server.transport.nethernet
      try {
        let result
        switch (signal.type) {
          case SignalType.ConnectRequest:
            result = transport.handleOffer(signal, signalling.write.bind(signalling), signalling.credentials)
            break
          case SignalType.CandidateAdd:
            result = transport.handleCandidate(signal)
            break
        }
        Promise.resolve(result).catch(error => server.onConnectionError(error))
      } catch (error) {
        server.onConnectionError(error)
      }
    })
    await signalling.connect()
  }

  start().catch(error => server.onConnectionError(error))
  return server
}

module.exports = { createServer }
