const { once } = require('events')
const { isIP } = require('net')
const { verifyServerIdentity } = require('./identity')

function signallingUrl ({ host = '127.0.0.1', port = 19132, nethernet = {} }) {
  const address = isIP(host) === 6 ? `[${host}]` : host
  const url = new URL(nethernet.url ?? `http://${address}:${port}`)
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('nethernet.url must be an HTTP(S) origin')
  }
  return new URL('/v1/join', url)
}

async function pingHttp (options) {
  const deadline = AbortSignal.timeout(options.timeout ?? 1000)
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline
  const response = await fetch(signallingUrl(options), { signal, redirect: 'error' })
  if (!response.ok) throw new Error(`Nethernet HTTP discovery returned ${response.status}`)
  const raw = await response.text()
  // BDS can return 200 with no metadata when LAN visibility is disabled.
  const data = raw ? JSON.parse(raw) : {}
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
    raw
  }
}

function setupHttpSignalling (client) {
  const url = signallingUrl(client.options)
  const nethernet = client.connection.nethernet
  const controller = new AbortController()
  client.once('close', () => controller.abort(new Error('Client closed during HTTP signalling')))
  nethernet.signalHandler = message => {
    if (message.type === 'CONNECTREQUEST') sendOffer(message.data).catch(error => client.onConnectionError(error))
  }

  async function sendOffer (offer) {
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(client.options.nethernet.signallingConnectTimeout ?? 15000)])
    const onAbort = () => client.onConnectionError(signal.reason)
    signal.throwIfAborted()
    signal.addEventListener('abort', onAbort, { once: true })
    try {
      const rtc = nethernet.rtcConnection
      while (rtc.iceGatheringState !== 'complete') await once(rtc, 'icegatheringstatechange', { signal })
      const identity = offer.split(/\r?\n/).find(line => line.startsWith('a=identity:'))
      if (!identity) throw new Error('Nethernet HTTP offer is missing its player identity')
      // ICE gathering changes candidates, but preserves the signed fingerprints.
      const body = rtc.localDescription.sdp.replace(/^m=/m, `${identity}\r\nm=`)
      const response = await fetch(`${url}/${nethernet.networkId}`, {
        method: 'POST', headers: { 'content-type': 'application/sdp' }, body, signal, redirect: 'error'
      })
      if (!response.ok) throw new Error(`Nethernet HTTP signalling returned ${response.status}`)
      const answer = await response.text()
      if (!answer.startsWith('v=')) throw new Error(`Nethernet HTTP rejected the offer: ${answer}`)
      const verified = verifyServerIdentity(answer)
      const { serverKey, onServerKey } = client.options.nethernet
      let trusted = serverKey ? serverKey === verified.fingerprint : url.protocol === 'https:'
      if (!trusted && !serverKey && onServerKey) trusted = await onServerKey(verified.fingerprint, url.origin) === true
      if (!trusted) {
        throw new Error(`Untrusted Nethernet server key ${verified.fingerprint}; configure nethernet.serverKey after verifying it`)
      }
      signal.throwIfAborted()
      await nethernet.handleAnswer({ data: verified.sdp, networkId: nethernet.serverNetworkId })
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
  }
}

module.exports = { pingHttp, setupHttpSignalling, signallingUrl }
