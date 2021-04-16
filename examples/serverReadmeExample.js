/* eslint-disable */
const bedrock = require('bedrock-protocol')
const server = new bedrock.createServer({
  hostname: '0.0.0.0',   // optional
  port: 19132,           // optional
  version: '1.16.220'    // The server version
})

server.on('connect', client => {
  client.on('join', () => { // The client has joined the server.
    const d = new Date()  // Once client is in the server, send a colorful hello
    client.write('disconnect', {
      hide_disconnect_reason: false,
      message: `Good ${d.getHours() < 12 ? '§emorning§r' : '§3afternoon§r'} :)\n\nMy time is ${d.toLocaleString()} !`
    })
  })
})