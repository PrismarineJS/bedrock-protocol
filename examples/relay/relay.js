const { Relay } = require('bedrock-protocol')

// Start your server first on port 19131.

// Start the proxy server
const relay = new Relay({
  version: '1.16.220', // The version
  /* host and port to listen for clients on */
  host: '0.0.0.0',
  port: 19132,
  /* Where to send upstream packets to */
  destination: {
    host: '127.0.0.1',
    port: 19131
  }
})
relay.conLog = console.debug
relay.listen() // Tell the server to start listening.

relay.on('connect', player => {
  console.log('New connection', player.connection.address)

  // Server is sending a message to the client.
  player.on('clientbound', ({ name, params }) => {
    if (name === 'disconnect') { // Intercept kick
      params.message = 'Intercepted' // Change kick message to "Intercepted"
    }
  })
  // Client is sending a message to the server
  player.on('serverbound', ({ name, params }) => {
    if (name === 'text') { // Intercept chat message to server and append time.
      params.message += `, on ${new Date().toLocaleString()}`
    }
  })
})

// Now clients can connect to your proxy
