const net = require('net')

const getPort = () => new Promise(resolve => {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  server.on('listening', () => {
    const { port } = server.address()
    server.close(() => {
      // Wait a bit for port to free as we try to bind right after freeing it
      setTimeout(() => {
        resolve(port)
      }, 200)
    })
  })
})

module.exports = { getPort }
