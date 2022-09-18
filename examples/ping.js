/**
 * Ping a server to retrieve metadata
 * 
 * Examples:
 *   node examples/ping.js
 *   node examples/ping.js 127.0.0.1:19132
 *   node examples/ping.js --realm_id 1234
 *   node examples/ping.js --realm_invite "https://realms.gg/AB1CD2EFA3B"
 *   node examples/ping.js --realm_name "My World"
 */

const bedrock = require('bedrock-protocol')

const options = { host: 'play.cubecraft.net', port: 19132 }

// if an address is specified from the command line, use that.
if (process.argv[2]) {
  ['host', 'port'].forEach(k => delete options[k])
  Object.assign(options, bedrock.parseAddress(...process.argv.slice(2)))
  if (options.port === undefined) {
    options.port = 19132
  }
}

bedrock.ping(options).then(res => {
  console.log(res)
})
