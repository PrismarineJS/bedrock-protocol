const createNativeBackend = require('./raknet/native')
const createJavascriptBackend = require('./raknet/javascript')

class RakTimeout extends Error {}

function withTimeout (backend) {
  return { ...backend, RakTimeout }
}

function setBackend (backend) {
  // We have to explicitly require the backend for bundlers
  switch (backend) {
    case 'raknet-node': {
      const { Client, Server, PacketPriority, PacketReliability } = require('raknet-node')
      return withTimeout(createNativeBackend({ Client, Server, PacketPriority, PacketReliability, RakTimeout }))
    }
    case 'raknet-native': {
      const { Client, Server, PacketPriority, PacketReliability } = require('raknet-native')
      return withTimeout(createNativeBackend({ Client, Server, PacketPriority, PacketReliability, RakTimeout }))
    }
    case 'jsp-raknet': {
      const { Client, Server, EncapsulatedPacket, Reliability } = require('jsp-raknet')
      return withTimeout(createJavascriptBackend({ Client, Server, EncapsulatedPacket, Reliability, RakTimeout }))
    }
  }
}

module.exports = (backend) => {
  if (backend) {
    return setBackend(backend)
  } else {
    try {
      return setBackend('raknet-native')
    } catch (e) {
      console.debug(`[raknet] ${backend} library not found, defaulting to jsp-raknet. Correct the "raknetBackend" option to avoid this error.`, e)
      return setBackend('jsp-raknet')
    }
  }
}
