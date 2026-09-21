const bedrockServer = require('minecraft-bedrock-server')

// The vanilla spawn and packet-dump clients use RakNet, even when BDS defaults to Nethernet.
module.exports = {
  ...bedrockServer,
  startServerAndWait (version, withTimeout, options) {
    return bedrockServer.startServerAndWait(version, withTimeout, { transport: 'raknet', ...options, root: __dirname })
  },
  startServerAndWait2 (version, withTimeout, options) {
    return bedrockServer.startServerAndWait2(version, withTimeout, { transport: 'raknet', ...options, root: __dirname })
  }
}
