const { isIP } = require('net')
const { pingHttp: discoverHttp } = require('nethernet')

function signallingUrl ({ host = '127.0.0.1', port = 19132, nethernet = {} }) {
  const address = isIP(host) === 6 ? `[${host}]` : host
  return nethernet.url ?? `http://${address}:${port}`
}

async function pingHttp (options) {
  const data = await discoverHttp(signallingUrl(options), options)
  return {
    transport: 'nethernet',
    signalling: 'http',
    motd: data.name,
    protocol: data.protocol,
    gameVersion: data.version,
    levelName: data.level,
    playersOnline: data.players,
    playersMax: data.maxPlayers,
    gamemodeId: data.gameType,
    raw: data.raw
  }
}

module.exports = { pingHttp, signallingUrl }
