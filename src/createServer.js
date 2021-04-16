const { Server } = require('./server')

function createServer (options) {
  options.hostname ??= options.host
  const server = new Server(options)
  server.listen()
  return server
}

module.exports = { createServer }
