const { Client } = require('../src/client')
const { CURRENT_VERSION } = require('../src/options')

function getTransport (version = CURRENT_VERSION) {
  return require('minecraft-data')('bedrock_' + version).supportFeature('defaultTransportIsNethernet') ? 'nethernet' : 'raknet'
}

// Local, offline BDS tests use HTTP signalling for Nethernet, without Xbox services.
function createVanillaClient (options) {
  const transport = options.transport ?? getTransport(options.version)
  const client = new Client({ ...options, transport, ...(transport === 'nethernet' ? { nethernet: { ...options.nethernet, networkId: 1n } } : {}) })
  if (transport === 'raknet') return client

  if (!options.offline) {
    client.close()
    throw new Error('Vanilla HTTP test clients require offline mode')
  }
  client.prependOnceListener('session', () => client.createClientChain(null, true))
  const controller = new AbortController()
  client.once('close', () => controller.abort(new Error('Vanilla client closed')))
  const nethernet = client.connection.nethernet
  nethernet.signalHandler = signal => {
    if (signal.type === 'CONNECTREQUEST') sendOffer(signal.data).catch(error => client.onConnectionError(error))
  }

  async function sendOffer (offer) {
    const rtc = nethernet.rtcConnection
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    await waitForIce(rtc, signal)
    // Gathering adds candidates but leaves the signed DTLS fingerprints unchanged.
    const identity = offer.split(/\r?\n/).find(line => line.startsWith('a=identity:'))
    if (!identity) throw new Error('Vanilla Nethernet offer is missing its offline identity')
    const sdpOffer = rtc.localDescription.sdp.replace(/^m=/m, `${identity}\r\nm=`)
    const response = await fetch(`http://${options.host}:${options.port}/v1/join/${nethernet.networkId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/sdp' },
      body: sdpOffer,
      signal
    })
    if (!response.ok) throw new Error(`Vanilla Nethernet signalling returned HTTP ${response.status}: ${await response.text()}`)
    // The test server is local and offline; leave identity verification to production clients.
    const body = await response.text()
    if (!body.startsWith('v=')) throw new Error(`Vanilla Nethernet rejected the offer: ${body}`)
    const sdp = body.split(/\r?\n/).filter(line => !line.startsWith('a=identity:')).join('\r\n')
    signal.throwIfAborted()
    await nethernet.handleAnswer({ data: sdp, networkId: nethernet.serverNetworkId })
  }

  return client
}

function waitForIce (rtc, signal) {
  return new Promise((resolve, reject) => {
    const finish = error => {
      rtc.removeEventListener('icegatheringstatechange', onChange)
      signal.removeEventListener('abort', onAbort)
      if (error) reject(error)
      else resolve()
    }
    const onChange = () => { if (rtc.iceGatheringState === 'complete') finish() }
    const onAbort = () => finish(signal.reason)
    rtc.addEventListener('icegatheringstatechange', onChange)
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
    else onChange()
  })
}

module.exports = { createVanillaClient, getTransport }
