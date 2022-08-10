const { createClient, Server, Relay } = require('bedrock-protocol')
const { sleep, waitFor } = require('../src/datatypes/util')

function proxyTest (version, raknetBackend = 'raknet-node', timeout = 1000 * 40) {
  console.log('with raknet backend', raknetBackend)
  return waitFor(async res => {
    const SERVER_PORT = 19000 + ((Math.random() * 100) | 0)
    const CLIENT_PORT = 19000 + ((Math.random() * 100) | 0)
    const server = new Server({
      host: '0.0.0.0', // optional
      port: SERVER_PORT, // optional
      offline: true,
      raknetBackend,
      version // The server version
    })
    await server.listen()

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
      port: CLIENT_PORT,
      /* Where to send upstream packets to */
      destination: {
        host: '127.0.0.1',
        port: SERVER_PORT
      },
      raknetBackend
    })
    relay.conLog = console.debug
    await relay.listen()

    console.debug('Proxy started', server.options.version)

    const client = createClient({ host: '127.0.0.1', port: CLIENT_PORT, version, username: 'Boat', offline: true, raknetBackend, skipPing: true })
    console.debug('Client started')
    client.on('error', console.log)
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
  proxyTest('1.16.220', 'raknet-native')
}

module.exports = { proxyTest }
