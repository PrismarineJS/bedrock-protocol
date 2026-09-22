const bedrockServer = require('minecraft-bedrock-server')
const { getTransport } = require('./vanillaClient')

// Match the vanilla clients to the transport default recorded in minecraft-data.
module.exports = {
  ...bedrockServer,
  startServerAndWait (version, withTimeout, options) {
    return bedrockServer.startServerAndWait(version, withTimeout, { transport: getTransport(version), ...options, root: __dirname })
  },
  startServerAndWait2 (version, withTimeout, options) {
    return bedrockServer.startServerAndWait2(version, withTimeout, { transport: getTransport(version), ...options, root: __dirname })
  }
}
