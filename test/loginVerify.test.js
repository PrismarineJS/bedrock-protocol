/* eslint-env mocha */

const assert = require('assert')
const crypto = require('crypto')
const JWT = require('jsonwebtoken')
const LoginVerify = require('../src/handshake/loginVerify')
const { createOidcVerifier } = require('../src/handshake/oidc')

const VERSION = '1.26.40'
const ISSUER = 'https://authorization.franchise.minecraft-services.net/'
const JWKS_URI = `${ISSUER}.well-known/keys`
const AUDIENCE = 'api://auth-minecraft-services/multiplayer'

function publicKeyBase64 (key) {
  return key.export({ format: 'der', type: 'spki' }).toString('base64')
}

function createVerifier (publicKey) {
  const jwk = publicKey.export({ format: 'jwk' })
  const fetchJson = async url => {
    if (url.includes('/api/v1.0/discovery/')) {
      return { result: { serviceEnvironments: { auth: { prod: { issuer: ISSUER } } } } }
    }
    if (url === `${ISSUER}.well-known/openid-configuration`) {
      return {
        issuer: ISSUER,
        jwks_uri: JWKS_URI,
        id_token_signing_alg_values_supported: ['RS256']
      }
    }
    if (url === JWKS_URI) return { keys: [{ ...jwk, kid: 'test-key', use: 'sig' }] }
    throw new Error(`Unexpected URL: ${url}`)
  }
  return createOidcVerifier({ fetchJson })
}

function createLoginTokens () {
  const clientKeys = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' })
  const serviceKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const cpk = publicKeyBase64(clientKeys.publicKey)
  const authToken = JWT.sign({
    cpk,
    xid: '2535427801234567',
    xname: 'VerifiedPlayer',
    mid: 'playfab-player-id',
    tid: '20CA2'
  }, serviceKeys.privateKey, {
    algorithm: 'RS256',
    audience: AUDIENCE,
    issuer: ISSUER,
    expiresIn: '5m',
    header: { kid: 'test-key', typ: undefined }
  })
  const skinToken = JWT.sign({ DeviceOS: 7, ThirdPartyName: 'VerifiedPlayer' }, clientKeys.privateKey, {
    algorithm: 'ES384',
    header: { x5u: cpk, typ: undefined }
  })
  return { authToken, clientKeys, serviceKeys, skinToken }
}

describe('modern login verification', () => {
  it('verifies the OIDC identity token and its bound client-data token', async () => {
    const { authToken, serviceKeys, skinToken } = createLoginTokens()
    const verifier = createVerifier(serviceKeys.publicKey)
    const client = {}
    LoginVerify(client, null, { offline: false, version: VERSION }, { verifyOidcToken: verifier.verify })

    const result = await client.decodeLoginJWT([], skinToken, authToken)
    assert.strictEqual(result.userData.extraData.XUID, '2535427801234567')
    assert.strictEqual(result.userData.extraData.displayName, 'VerifiedPlayer')
    assert.strictEqual(result.userData.extraData.PlayFabID, 'playfab-player-id')
    assert.strictEqual(result.userData.extraData.PlayFabTitleID, '20CA2')
    assert.match(result.userData.extraData.identity, /^[0-9a-f-]{36}$/)
    assert.strictEqual(result.skinData.ThirdPartyName, 'VerifiedPlayer')
    assert.deepStrictEqual(result.authentication, {
      authenticated: true,
      method: 'oidc',
      issuer: ISSUER
    })
  })

  it('rejects an identity token with an invalid Microsoft signature', async () => {
    const { authToken, serviceKeys, skinToken } = createLoginTokens()
    const verifier = createVerifier(serviceKeys.publicKey)
    const client = {}
    LoginVerify(client, null, { offline: false, version: VERSION }, { verifyOidcToken: verifier.verify })

    const parts = authToken.split('.')
    parts[1] = Buffer.from(JSON.stringify({ ...JWT.decode(authToken), xname: 'Impostor' })).toString('base64url')
    await assert.rejects(client.decodeLoginJWT([], skinToken, parts.join('.')), /invalid signature/)
  })

  it('rejects client data not signed by the key in the verified identity token', async () => {
    const { authToken, serviceKeys } = createLoginTokens()
    const verifier = createVerifier(serviceKeys.publicKey)
    const attackerKeys = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' })
    const forgedSkinToken = JWT.sign({ ThirdPartyName: 'Impostor' }, attackerKeys.privateKey, { algorithm: 'ES384' })
    const client = {}
    LoginVerify(client, null, { offline: false, version: VERSION }, { verifyOidcToken: verifier.verify })

    await assert.rejects(client.decodeLoginJWT([], forgedSkinToken, authToken), /invalid signature/)
  })

  it('rejects tokens for a different audience', async () => {
    const { serviceKeys } = createLoginTokens()
    const verifier = createVerifier(serviceKeys.publicKey)
    const token = JWT.sign({ cpk: 'unused' }, serviceKeys.privateKey, {
      algorithm: 'RS256',
      audience: 'not-minecraft',
      issuer: ISSUER,
      expiresIn: '5m',
      header: { kid: 'test-key', typ: undefined }
    })

    await assert.rejects(verifier.verify(token, VERSION), /jwt audience invalid/)
  })

  it('rejects expired tokens', async () => {
    const { serviceKeys } = createLoginTokens()
    const verifier = createVerifier(serviceKeys.publicKey)
    const token = JWT.sign({ cpk: 'unused' }, serviceKeys.privateKey, {
      algorithm: 'RS256',
      audience: AUDIENCE,
      issuer: ISSUER,
      expiresIn: -1,
      header: { kid: 'test-key', typ: undefined }
    })

    await assert.rejects(verifier.verify(token, VERSION), /jwt expired/)
  })

  it('rejects verified OIDC payloads missing required identity claims', async () => {
    const { authToken, skinToken } = createLoginTokens()
    const client = {}
    const validPayload = JWT.decode(authToken)
    LoginVerify(client, null, { offline: false, version: VERSION }, {
      verifyOidcToken: async () => ({ ...validPayload, xid: undefined })
    })
    await assert.rejects(client.decodeLoginJWT([], skinToken, authToken), /XUID is invalid/)

    LoginVerify(client, null, { offline: false, version: VERSION }, {
      verifyOidcToken: async () => ({ ...validPayload, xname: undefined })
    })
    await assert.rejects(client.decodeLoginJWT([], skinToken, authToken), /display name/)

    LoginVerify(client, null, { offline: false, version: VERSION }, {
      verifyOidcToken: async () => ({ ...validPayload, exp: undefined })
    })
    await assert.rejects(client.decodeLoginJWT([], skinToken, authToken), /missing its expiry/)

    LoginVerify(client, null, { offline: false, version: VERSION }, {
      verifyOidcToken: async () => ({ ...validPayload, iss: undefined })
    })
    await assert.rejects(client.decodeLoginJWT([], skinToken, authToken), /missing its issuer/)
  })

  it('rejects a non-P-384 client key in an otherwise verified OIDC payload', async () => {
    const { authToken, skinToken } = createLoginTokens()
    const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const client = {}
    LoginVerify(client, null, { offline: false, version: VERSION }, {
      verifyOidcToken: async () => ({ ...JWT.decode(authToken), cpk: publicKeyBase64(rsa.publicKey) })
    })

    await assert.rejects(client.decodeLoginJWT([], skinToken, authToken), /must be an EC P-384 key/)
  })
})
