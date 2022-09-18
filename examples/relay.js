/**
 * A simple relay to demonstrate connectivity.
 * 
 * Command line options accepted are:
 *  - serverAddress (optional, required if destinationAddress used):
 *      - default: "0.0.0.0:19130"
 *      - "{host}"
 *      - "{host:port}"
 *  - destinationAddress (optional):
 *      - default: "127.0.0.1:19132"
 *      - "{host}"
 *      - "{host:port}"
 *      - "--realm_id" "{id}"
 *      - "--realm_invite" "{invite_link}"
 *      - "--realm_name" "{name}"
 * 
 * Examples:
 *   node examples/relay.js
 *   node examples/relay.js 127.0.0.1:19132
 *   node examples/relay.js 127.0.0.1:19132 127.0.0.1:19134
 *   node examples/relay.js 127.0.0.1:19132 --realm_id 1234
 *   node examples/relay.js 127.0.0.1:19132 --realm_invite "https://realms.gg/AB1CD2EFA3B"
 *   node examples/relay.js 127.0.0.1:19132 --realm_name "My World"
 */

const bedrock = require('bedrock-protocol')

// Start your server first on port 19132.

options = {
  version: '1.16.220', // The version
  /* host and port to listen for clients on */
  host: '0.0.0.0',
  port: 19130,
  /* Where to send upstream packets to */
  destination: {
    host: '127.0.0.1',
    port: 19132
  }
}

if (process.argv[2]) {
  Object.apply(options, bedrock.parseAddress(process.argv[2]))
  if (options.port === undefined) {
    options.port = 19132
  }
}
if (process.argv[3]) {
  options.destination = bedrock.parseAddress(...process.argv.slice(3))
  if (options.destination.host && options.destination.port === undefined) {
    options.destination.port = 19132
  }
}

// Start the proxy server
const relay = new bedrock.Relay(options)
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
