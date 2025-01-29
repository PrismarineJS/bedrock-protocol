const os = require('node:os')

function getBroadcastAddress () {
  const interfaces = os.networkInterfaces()

  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      // Only consider IPv4, non-internal (non-loopback) addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        const ip = iface.address.split('.').map(Number)
        const netmask = iface.netmask.split('.').map(Number)
        const broadcast = ip.map((octet, i) => (octet | (~netmask[i] & 255)))

        return broadcast.join('.') // Return the broadcast address
      }
    }
  }
}

module.exports = {
  getBroadcastAddress
}
