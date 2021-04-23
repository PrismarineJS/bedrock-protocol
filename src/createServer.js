const { Server } = require('./server')

function createServer (options) {
  if (!options.port) options.port = 19132
  const server = new Server(options)
  server.listen()
  return server
}

module.exports = { createServer }
