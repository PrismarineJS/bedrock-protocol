const { Server } = require('./server')
const { NethernetSignal } = require('./websocket/signal')
const assert = require('assert')

const { getRandomUint64 } = require('./datatypes/util')
const { serverAuthenticate } = require('./client/auth')
const { SignalType } = require('./nethernet/signalling')

/** @param {{ port?: number, version?: number, networkId?: string, transport?: string, delayedInit?: boolean }} options */
function createServer (options) {
  assert(options)
  if (!options.networkId) options.networkId = getRandomUint64()
  if (!options.port) options.port = 19132
  const server = new Server(options)

  function startSignalling () {
    if (server.options.transport === 'nethernet') {
      server.signalling = new NethernetSignal(server.options.networkId, server.options.authflow)

      server.signalling.connect(server.options.version)
        .then(() => {
          server.signalling.on('signal', (signal) => {
            switch (signal.type) {
              case SignalType.ConnectRequest:
                server.transport.nethernet.handleOffer(signal, server.signalling.write.bind(server.signalling), server.signalling.credentials)
                break
              case SignalType.CandidateAdd:
                server.transport.nethernet.handleCandidate(signal)
                break
            }
          })
        })
        .catch(e => server.emit('error', e))
    }
  }

  if (server.options.useSignalling) {
    serverAuthenticate(server, server.options)
      .then(startSignalling)
      .then(() => server.listen())
      .catch(e => server.emit('error', e))
  } else {
    server.listen()
  }

  server.once('close', () => {
    if (server.session) server.session.end()
    if (server.signalling) server.signalling.destroy()
  })

  return server
}

module.exports = { createServer }
