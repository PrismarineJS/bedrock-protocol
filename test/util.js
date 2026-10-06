const dgram = require('dgram')
const net = require('net')

// Probe the protocol that will bind the port: RakNet uses UDP, HTTP signalling uses TCP.
const getPort = (protocol = 'udp') => new Promise((resolve, reject) => {
  const socket = protocol === 'tcp' ? net.createServer() : dgram.createSocket('udp4')
  socket.once('error', reject)
  socket.once('listening', () => {
    const { port } = socket.address()
    socket.close(() => {
      // Wait a bit for port to free as we try to bind right after freeing it
      setTimeout(() => {
        resolve(port)
      }, 200)
    })
  })
  if (protocol === 'tcp') socket.listen(0, '127.0.0.1')
  else socket.bind(0)
})

module.exports = { getPort }
