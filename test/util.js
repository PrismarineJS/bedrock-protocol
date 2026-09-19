const dgram = require('dgram')

// The tests bind UDP servers, so probe for a free port over UDP too: a port
// that is free for TCP can still be unavailable for UDP (notably on Windows,
// which reserves excluded port ranges per protocol).
const getPort = () => new Promise((resolve, reject) => {
  const socket = dgram.createSocket('udp4')
  socket.once('error', reject)
  socket.bind(0, () => {
    const { port } = socket.address()
    socket.close(() => {
      // Wait a bit for port to free as we try to bind right after freeing it
      setTimeout(() => {
        resolve(port)
      }, 200)
    })
  })
})

module.exports = { getPort }
