const mcData = require('minecraft-data')

// Minimum supported version (< will be kicked)
const MIN_VERSION = '1.16.201'
// Currently supported verson. Note, clients with newer versions can still connect as long as data is in minecraft-data
const CURRENT_VERSION = '1.18.11'

const Versions = Object.fromEntries(mcData.versions.bedrock.filter(e => e.releaseType === 'release').map(e => [e.minecraftVersion, e.version]).reverse())

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
  // Whether or not to use C++ version of RakNet
  useNativeRaknet: true,
  // If using JS implementation of RakNet, should we use workers? (This only affects the client)
  useRaknetWorkers: true
}

module.exports = { defaultOptions, MIN_VERSION, CURRENT_VERSION, Versions }
