const { createClient, createServer, Relay } = require('bedrock-protocol')
const { sleep, waitFor } = require('../src/datatypes/util')

function proxyTest (version, timeout = 1000 * 40) {
  return waitFor(res => {
    const server = createServer({
      host: '0.0.0.0', // optional
      port: 19131, // optional
      offline: true,
      version // The server version
    })

    server.on('connect', client => {
      console.debug('Client has connected')
      client.on('join', () => { // The client has joined the server.
        console.debug('Client has authenticated')
        setTimeout(() => {
          client.disconnect('Hello world !')
        }, 1000) // allow some time for client to connect
      })
    })

    console.debug('Server started', server.options.version)

    const relay = new Relay({
      version,
      offline: true,
      /* host and port for clients to listen to */
      host: '0.0.0.0',
      port: 19132,
      /* Where to send upstream packets to */
      destination: {
        host: '127.0.0.1',
        port: 19131
      }
    })
    relay.conLog = console.debug
    relay.listen()

    console.debug('Proxy started', server.options.version)

    const client = createClient({ host: '127.0.0.1', version, username: 'Boat', offline: true })

    console.debug('Client started')

    client.on('packet', console.log)

    client.on('disconnect', packet => {
      console.assert(packet.message === 'Hello world !')

      server.close()
      relay.close()
      console.log('✔ OK')
      sleep(500).then(res)
    })
  }, timeout, () => { throw Error('timed out') })
}

if (!module.parent) {
  proxyTest('1.16.220')
}

module.exports = { proxyTest }
