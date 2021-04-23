const { Relay } = require('../src/relay')

function createRelay () {
  console.log('Creating relay')
  /* Example to create a non-transparent proxy (or 'Relay') connection to destination server */
  const relay = new Relay({
    /* host and port for clients to listen to */
    host: '0.0.0.0',
    port: 19130,
    /* Where to send upstream packets to */
    destination: {
      host: '127.0.0.1',
      port: 19132
    }
  })
  relay.conLog = console.debug
  relay.listen()
}

createRelay()
