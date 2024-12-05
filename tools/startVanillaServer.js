const bedrockServer = require('minecraft-bedrock-server')

module.exports = {
  ...bedrockServer,
  startServerAndWait (version, withTimeout, options) {
    return bedrockServer.startServerAndWait(version, withTimeout, { ...options, root: __dirname })
  },
  startServerAndWait2 (version, withTimeout, options) {
    return bedrockServer.startServerAndWait2(version, withTimeout, { ...options, root: __dirname })
  }
}
