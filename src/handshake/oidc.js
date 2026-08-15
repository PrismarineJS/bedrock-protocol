const crypto = require('crypto')
const https = require('https')
const JWT = require('jsonwebtoken')

const DISCOVERY_URL = 'https://client.discovery.minecraft-services.net/api/v1.0/discovery/MinecraftPE/builds/'
const AUDIENCE = 'api://auth-minecraft-services/multiplayer'
const KEY_REFRESH_INTERVAL = 30 * 60 * 1000
const REQUEST_TIMEOUT = 15000
const MAX_RESPONSE_SIZE = 1024 * 1024

function requestJson (url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'bedrock-protocol'
      }
    }, response => {
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`OIDC request failed with status ${response.statusCode}`))
        return
      }

      const chunks = []
      let length = 0
      response.on('data', chunk => {
        length += chunk.length
        if (length > MAX_RESPONSE_SIZE) {
          request.destroy(new Error('OIDC response is too large'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch (error) {
          reject(new Error(`Invalid OIDC response: ${error.message}`))
        }
      })
    })
    request.setTimeout(REQUEST_TIMEOUT, () => request.destroy(new Error('OIDC request timed out')))
    request.on('error', reject)
  })
}

function normalizeIssuer (issuer) {
  return issuer.endsWith('/') ? issuer : `${issuer}/`
}

function assertHttpsUrl (value, name) {
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS`)
  return url.toString()
}

function createOidcVerifier ({ fetchJson = requestJson, keyRefreshInterval = KEY_REFRESH_INTERVAL } = {}) {
  const environments = new Map()
  const configurations = new Map()
  const keySets = new Map()

  async function cached (cache, key, load) {
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(load))
    const promise = cache.get(key)
    try {
      return await promise
    } catch (error) {
      if (cache.get(key) === promise) cache.delete(key)
      throw error
    }
  }

  async function getEnvironment (version) {
    return cached(environments, version, async () => {
      const discovery = await fetchJson(`${DISCOVERY_URL}${encodeURIComponent(version)}`)
      const auth = discovery?.result?.serviceEnvironments?.auth?.prod
      if (!auth?.issuer) throw new Error('Minecraft service discovery did not provide an OIDC issuer')
      return { issuer: normalizeIssuer(assertHttpsUrl(auth.issuer, 'OIDC issuer')) }
    })
  }

  async function getConfiguration (issuer) {
    return cached(configurations, issuer, async () => {
      const configuration = await fetchJson(new URL('.well-known/openid-configuration', issuer).toString())
      if (normalizeIssuer(configuration?.issuer || '') !== issuer) {
        throw new Error('OIDC configuration issuer does not match Minecraft service discovery')
      }
      if (!configuration.id_token_signing_alg_values_supported?.includes('RS256')) {
        throw new Error('OIDC configuration does not support RS256')
      }
      return {
        issuer,
        jwksUri: assertHttpsUrl(configuration.jwks_uri, 'OIDC JWKS URI')
      }
    })
  }

  async function refreshKeys (jwksUri) {
    const current = keySets.get(jwksUri)
    if (current?.inflight) return current.inflight

    const inflight = (async () => {
      const keySet = await fetchJson(jwksUri)
      if (!Array.isArray(keySet?.keys)) throw new Error('OIDC JWKS response did not contain keys')
      const keys = keySet.keys.filter(key => key.kty === 'RSA' && key.use === 'sig' && key.kid && key.n && key.e)
      if (keys.length === 0) throw new Error('OIDC JWKS response did not contain RSA signing keys')
      const entry = { keys, fetchedAt: Date.now(), inflight: null }
      keySets.set(jwksUri, entry)
      return entry
    })()

    keySets.set(jwksUri, { ...current, inflight })
    try {
      return await inflight
    } catch (error) {
      if (current?.keys) keySets.set(jwksUri, current)
      else keySets.delete(jwksUri)
      throw error
    }
  }

  async function getKey (jwksUri, kid) {
    let entry = keySets.get(jwksUri)
    if (!entry?.keys) entry = await refreshKeys(jwksUri)

    let key = entry.keys.find(key => key.kid === kid)
    if (!key && Date.now() - entry.fetchedAt >= keyRefreshInterval) {
      entry = await refreshKeys(jwksUri)
      key = entry.keys.find(key => key.kid === kid)
    }
    if (!key) throw new Error(`OIDC signing key ${kid} was not found`)
    return crypto.createPublicKey({ key, format: 'jwk' })
  }

  async function verify (token, version) {
    const decoded = JWT.decode(token, { complete: true })
    if (!decoded || typeof decoded.payload !== 'object') throw new Error('Invalid OIDC token')
    if (decoded.header.alg !== 'RS256' || !decoded.header.kid) throw new Error('OIDC token must use RS256 and include a kid')

    const environment = await getEnvironment(version)
    const configuration = await getConfiguration(environment.issuer)
    const publicKey = await getKey(configuration.jwksUri, decoded.header.kid)
    return JWT.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: AUDIENCE,
      issuer: configuration.issuer
    })
  }

  return { verify }
}

const verifier = createOidcVerifier()

module.exports = {
  createOidcVerifier,
  verifyOidcToken: (token, version) => verifier.verify(token, version)
}
