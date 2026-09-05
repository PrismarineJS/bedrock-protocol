let main = './raknet.node'

if (process.platform === 'win32') main = './win-raknet.node'

module.exports = require(main)