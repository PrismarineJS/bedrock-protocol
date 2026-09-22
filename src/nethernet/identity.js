const { createPublicKey, createHash } = require('crypto')
const JWT = require('jsonwebtoken')

// Verify possession of the operator key and bind it to WebRTC's DTLS fingerprints.
// Trust in that key (HTTPS or an application pin) is checked separately.
function verifyServerIdentity (sdp) {
  const lines = sdp.split(/\r?\n/)
  const identities = lines.filter(line => line.startsWith('a=identity:'))
  if (identities.length !== 1) throw new Error('Expected one Nethernet server identity assertion')
  const envelope = JSON.parse(Buffer.from(identities[0].slice('a=identity:'.length), 'base64').toString())
  if (envelope.idp?.protocol !== 'default') throw new Error('Unsupported Nethernet identity protocol')
  const assertion = JSON.parse(envelope.assertion)
  const claims = JWT.decode(assertion.token)
  const key = createPublicKey({ key: claims?.cpk, format: 'jwk' })
  JWT.verify(assertion.token, key)

  const fingerprints = lines.filter(line => line.startsWith('a=fingerprint:')).map(line => {
    const match = /^a=fingerprint:(\S+)\s+([\da-f:]+)$/i.exec(line)
    if (!match) throw new Error('Invalid Nethernet DTLS fingerprint')
    return { algorithm: match[1], digest: match[2] }
  })
  if (!fingerprints.length) throw new Error('Missing Nethernet DTLS fingerprint')
  const parts = assertion.fingerprints.split('.')
  if (parts.length !== 3 || parts[1] !== '') throw new Error('Invalid detached fingerprint signature')
  parts[1] = Buffer.from(JSON.stringify({ fingerprint: fingerprints })).toString('base64url')
  JWT.verify(parts.join('.'), key)

  return {
    fingerprint: 'sha256:' + createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex'),
    sdp: lines.filter(line => !line.startsWith('a=identity:')).join('\r\n')
  }
}

module.exports = { verifyServerIdentity }
