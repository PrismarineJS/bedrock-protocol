/* eslint-disable */
const bedrock = require('bedrock-protocol')
const server = new bedrock.createServer({
  host: '0.0.0.0',        // optional
  port: 19132,            // optional
  version: '1.17.10',    // The server version
  motd: {                 // The message of the day
    motd: 'Funtime Server',
    levelName: 'Wonderland'
  }
})

server.on('connect', client => {
  client.on('join', () => { // The client has joined the server.
    const d = new Date()  // Once client is in the server, send a colorful kick message
    client.disconnect(`Good ${d.getHours() < 12 ? '§emorning§r' : '§3afternoon§r'} :)\n\nMy time is ${d.toLocaleString()} !`)
  })
})