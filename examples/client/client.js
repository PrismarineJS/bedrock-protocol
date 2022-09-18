/* eslint-disable */
/**
 * Creates a client and echos the in-game chat
 * 
 * 
 * Examples:
 *   node examples/client.js
 *   node examples/client.js 127.0.0.1:19132
 *   node examples/client.js --realm_id 1234
 *   node examples/client.js --realm_invite "https://realms.gg/AB1CD2EFA3B"
 *   node examples/client.js --realm_name "My World"
 */

const bedrock = require('bedrock-protocol')

const options = {
  host: 'localhost',   // optional
  port: 19132,         // optional, default 19132
  username: 'Notch',   // the username you want to join as, optional if online mode
  offline: false      // optional, default false. if true, do not login with Xbox Live. You will not be asked to sign-in if set to true.
}

// if an address is specified from the command line, use that.
if (process.argv[2]) {
  Object.assign(options, bedrock.parseAddress(...process.argv.slice(2)))
}

const client = bedrock.createClient(options)

client.on('text', (packet) => { // Listen for chat messages and echo them back.
  console.log('Received Text:', packet)
  if (packet.source_name != client.username) {
    client.queue('text', {
      type: 'chat', needs_translation: false, source_name: client.username, xuid: '', platform_chat_id: '',
      message: `${packet.source_name} said: ${packet.message} on ${new Date().toLocaleString()}`
    })
  }
})
