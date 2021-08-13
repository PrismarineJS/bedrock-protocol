if (typeof process !== 'undefined' && parseInt(process.versions.node.split('.')[0]) < 14) {
  console.error('Your node version is currently', process.versions.node)
  console.error('Please update it to a version >= 14.x.x from https://nodejs.org/')
  process.exit(1)
}

const { Client } = require('./src/client')
const { Server } = require('./src/server')
const { Relay } = require('./src/relay')
const { createClient, ping } = require('./src/createClient')
const { createServer } = require('./src/createServer')
const { Titles } = require('prismarine-auth')

module.exports = {
  Client,
  Server,
  Relay,
  createClient,
  ping,
  createServer,
  title: Titles
}
