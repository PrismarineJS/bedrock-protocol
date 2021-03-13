// Minimum supported version (< will be kicked)
const MIN_VERSION = '1.16.201'
// Currently supported verson
const CURRENT_VERSION = '1.16.201'

const defaultOptions = {
  // https://minecraft.gamepedia.com/Protocol_version#Bedrock_Edition_2
  version: CURRENT_VERSION
}

const Versions = {
  '1.16.210': 428,
  '1.16.201': 422
}

module.exports = { defaultOptions, MIN_VERSION, CURRENT_VERSION, Versions }
