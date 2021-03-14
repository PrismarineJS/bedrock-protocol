// Minimum supported version (< will be kicked)
const MIN_VERSION = '1.16.201'
// Currently supported verson
const CURRENT_VERSION = '1.16.201'

const defaultOptions = {
  // https://minecraft.gamepedia.com/Protocol_version#Bedrock_Edition_2
  version: CURRENT_VERSION,
  // client: If we should send SetPlayerInitialized to the server after getting play_status spawn.
  // if this is disabled, no 'spawn' event will be emitted, you should manually set
  // client.status to ClientStatus.Initialized after sending the init packet.
  autoInitPlayer: true
}

const Versions = {
  // TODO
  // '1.16.210': 428,
  '1.16.201': 422
}

module.exports = { defaultOptions, MIN_VERSION, CURRENT_VERSION, Versions }
