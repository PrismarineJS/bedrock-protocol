const { parse: parseJson, stringify } = require('json-bigint')({ storeAsString: true })
const { SignalStructure } = require('nethernet')

function parseTurnServers (dataString) {
  const data = parseJson(dataString)
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
    const parsed = parseJson(message)
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

function encodeSignal (signal, networkId, protocol, id, messageId) {
  if (protocol === 'jsonrpc') {
    return stringify({
      jsonrpc: '2.0',
      id,
      method: 'Signaling_SendClientMessage_v1_0',
      params: {
        toPlayerId: String(signal.networkId),
        messageId,
        message: stringify({
          jsonrpc: '2.0',
          method: 'Signaling_WebRtc_v1_0',
          params: { netherNetId: String(networkId), message: signal.toString() }
        })
      }
    })
  }
  // Legacy numeric network IDs are JSON integers on the wire, but strings
  // internally so they never pass through an imprecise JavaScript Number.
  const destination = String(signal.networkId)
  const to = /^\d+$/.test(destination) ? BigInt(destination) : destination
  return stringify({ Type: 1, To: to, Message: signal.toString() })
}

module.exports = { parseJson, encodeSignal, parseTurnServers, parseTurnAuth, parseSignalMessage, parseJsonRpcReceiveItem }
