const { SignalStructure } = require('node-nethernet')

function parseTurnServers (dataString) {
  const data = JSON.parse(dataString)
  return parseTurnAuth(data)
}

function parseTurnAuth (data) {
  return data.TurnAuthServers.map(server => ({
    urls: server.Urls,
    username: server.Username,
    credential: server.Password
  }))
}

function parseSignalMessage (message) {
  if (typeof message !== 'string') return null

  try {
    const parsed = JSON.parse(message)
    const signal = parseJsonRpcSignal(parsed)
    if (signal) return signal
  } catch {}

  try {
    return SignalStructure.fromString(message)
  } catch {
    return null
  }
}

function parseJsonRpcSignal (message) {
  const params = message?.params || message?.result
  if (!params || typeof params !== 'object') return null

  const signalText = params.message || params.Message || params.innerMessage
  if (!signalText) return null

  try {
    const signal = SignalStructure.fromString(signalText)
    const networkId = params.netherNetId || params.NetherNetId || params.fromNetherNetId || params.fromPlayerId
    if (networkId) signal.networkId = String(networkId)
    return signal
  } catch {
    return null
  }
}

function parseJsonRpcReceiveItem (item) {
  if (!item || typeof item !== 'object') return null

  const message = item.Message || item.message
  if (!message) return null

  const signal = parseSignalMessage(message)
  if (!signal) return null

  const networkId = item.From || item.from || item.fromPlayerId || signal.networkId
  if (networkId) signal.networkId = String(networkId)

  return signal
}

module.exports = { parseTurnServers, parseTurnAuth, parseSignalMessage, parseJsonRpcReceiveItem }
