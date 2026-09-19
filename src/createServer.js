const { Server } = require('./server')
const { NethernetSignal } = require('./websocket/signal')
const assert = require('assert')

const { getRandomUint64 } = require('./datatypes/util')
const { serverAuthenticate } = require('./client/auth')
const { SignalType } = require('node-nethernet')

/** @param {{ port?: number, version?: string, networkId?: string | bigint, transport?: string }} options */
function createServer (options) {
  assert(options)
  const server = new Server({ networkId: getRandomUint64(), port: 19132, ...options })

  async function start () {
    // Bind before publishing the session or accepting signalling offers.
    await server.listen()
    if (server._closed) return
    if (server.options.transport !== 'nethernet' || !server.options.useSignalling) return

    await serverAuthenticate(server, server.options)
    if (server._closed) return

    const signalling = new NethernetSignal(server.options.networkId, server.options.authflow, server.options.version, {
      timeout: server.options.signallingTimeout
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
