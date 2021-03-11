'use strict'

const pmp = require('../')

if (process.argv.length !== 4) {
  console.log('Usage: node server.js <host> <port>')
  process.exit(1)
}

const server = pmp.createServer({
  host: process.argv[2],
  port: parseInt(process.argv[3]),
  name: 'MCPE;Minecraft: PE Server;81 81;0.15.0;0;20'
})

server.on('connection', function (client) {
  client.on('mcpe', packet => console.log(packet))

  client.on('login_mcpe', data => {
    console.log(client.displayName + '(' + client.XUID + ') ' + ' joined the game')
  })

  client.on('error', err => {
    console.error(err)
  })

  client.on('end', () => {
    console.log('client left')
  })
})
