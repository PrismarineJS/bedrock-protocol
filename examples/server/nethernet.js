/* eslint-disable */
process.env.DEBUG = 'minecraft-protocol'

const bedrock = require('bedrock-protocol')

const server = bedrock.createServer({
  transport: 'nethernet',
  useSignalling: true, // disable for LAN connections only
  motd: {
    motd: 'Funtime Server',
    levelName: 'Wonderland'
  }
})

server.on('connect', client => {
  client.on('join', () => { // The client has joined the server.
    const date = new Date()  // Once client is in the server, send a colorful kick message
    client.disconnect(`Good ${date.getHours() < 12 ? '§emorning§r' : '§3afternoon§r'}\n\nMy time is ${date.toLocaleString()} !`)
  })
})
