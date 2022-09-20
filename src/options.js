const mcData = require('minecraft-data')

// Minimum supported version (< will be kicked)
const MIN_VERSION = '1.16.201'
// Currently supported verson. Note, clients with newer versions can still connect as long as data is in minecraft-data
const CURRENT_VERSION = '1.19.21'

const Versions = Object.fromEntries(mcData.versions.bedrock.filter(e => e.releaseType === 'release').map(e => [e.minecraftVersion, e.version]))

const defaultOptions = {
  // https://minecraft.gamepedia.com/Protocol_version#Bedrock_Edition_2
  version: CURRENT_VERSION,
  // client: If we should send SetPlayerInitialized to the server after getting play_status spawn.
  // if this is disabled, no 'spawn' event will be emitted, you should manually set
  // client.status to ClientStatus.Initialized after sending the init packet.
  autoInitPlayer: true,
  // If true, do not authenticate with Xbox Live
  offline: false,
  // Milliseconds to wait before aborting connection attempt
  connectTimeout: 9000,
  // Specifies the raknet implementation to use
  raknetBackend: 'raknet-native',
  // If using JS implementation of RakNet, should we use workers? (This only affects the client)
  useRaknetWorkers: true
}

function validateOptions (options) {
  if (!Versions[options.version]) {
    console.warn('Supported versions', Versions)
    throw Error(`Unsupported version ${options.version}`)
  }

  options.protocolVersion = Versions[options.version]
  if (options.protocolVersion < MIN_VERSION) {
    throw new Error(`Protocol version < ${MIN_VERSION} : ${options.protocolVersion}, too old`)
  }
  this.compressionLevel = options.compressionLevel || 7
  if (options.useNativeRaknet === true) options.raknetBackend = 'raknet-native'
  if (options.useNativeRaknet === false) options.raknetBackend = 'jsp-raknet'
}

module.exports = { defaultOptions, MIN_VERSION, CURRENT_VERSION, Versions, validateOptions }
