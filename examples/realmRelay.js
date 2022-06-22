const { Relay } = require('bedrock-protocol')

function createRelay () {
  console.log('Creating relay')
  /* Example to create a non-transparent proxy (or 'Relay') connection to destination server */
  const relay = new Relay({
    /* host and port for clients to listen to */
    host: '0.0.0.0',
    port: 19130,
    offline: false,
    /* Where to send upstream packets to */
    destination: {
      realms: {
        pickRealm: (realms) => realms.find(e => e.name === 'Realm Name')
      },
      offline: false
    }
  })
  relay.conLog = console.debug
  relay.listen()
  relay.on('connect', player => {
    // Server is sending a message to the client.
    player.on('clientbound', ({ name, params }) => {
      if (name === 'text') console.log(params)
    })
  })
}

createRelay()
