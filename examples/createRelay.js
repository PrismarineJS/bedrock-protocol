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
 *   node examples/createRelay.js
 *   node examples/createRelay.js 127.0.0.1:19132
 *   node examples/createRelay.js 127.0.0.1:19132 127.0.0.1:19134
 *   node examples/createRelay.js 127.0.0.1:19132 --realm_id 1234
 *   node examples/createRelay.js 127.0.0.1:19132 --realm_invite "https://realms.gg/AB1CD2EFA3B"
 *   node examples/createRelay.js 127.0.0.1:19132 --realm_name "My World"
 */

const bedrock = require('bedrock-protocol')

const options = {
  /* host and port for clients to listen to */
  host: '0.0.0.0',
  port: 19130,
  offline: false,
  /* Where to send upstream packets to */
  destination: {
    host: '127.0.0.1',
    port: 19132,
    offline: false
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

function createRelay () {
  console.log('Creating relay')
  /* Example to create a non-transparent proxy (or 'Relay') connection to destination server */
  const relay = new bedrock.Relay(options)
  relay.conLog = console.debug
  relay.listen()
}

createRelay()
