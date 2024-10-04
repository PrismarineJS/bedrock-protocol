const os = require('os')

function getBroadcastAddress () {
  const networkInterfaces = os.networkInterfaces()
  let broadcastAddress = null

  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName]
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const ipAddress = iface.address
        const netmask = iface.netmask

        broadcastAddress = calculateBroadcastAddress(ipAddress, netmask)
      }
    }
  }

  return broadcastAddress
}

function calculateBroadcastAddress (ipAddress, netmask) {
  const ipParts = ipAddress.split('.').map(Number)
  const maskParts = netmask.split('.').map(Number)

  const ip = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]
  const mask = (maskParts[0] << 24) | (maskParts[1] << 16) | (maskParts[2] << 8) | maskParts[3]

  const broadcast = ip | (~mask >>> 0)

  return [
    (broadcast >>> 24) & 0xff,
    (broadcast >>> 16) & 0xff,
    (broadcast >>> 8) & 0xff,
    broadcast & 0xff
  ].join('.')
}

module.exports = {
  getBroadcastAddress
}
