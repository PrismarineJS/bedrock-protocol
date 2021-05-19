const msal = require('@azure/msal-node')
const XboxLiveAuth = require('@xboxreplay/xboxlive-auth')
const debug = require('debug')('minecraft-protocol')
const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const authConstants = require('./authConstants')
const crypto = require('crypto')
const { nextUUID } = require('../datatypes/util')
const { SmartBuffer } = require('smart-buffer')
const jose = require('jose-node-cjs-runtime/jwk/from_key_like')

class LiveTokenManager {
  constructor (clientId, scopes, cacheLocation) {
    this.clientId = clientId
    this.scopes = scopes
    this.cacheLocation = cacheLocation
    this.reloadCache()
  }

  reloadCache () {
    try {
      this.cache = require(this.cacheLocation)
    } catch (e) {
      this.cache = {}
      fs.writeFileSync(this.cacheLocation, JSON.stringify(this.cache))
    }
  }

  async verifyTokens () {
    if (this.forceRefresh) try { await this.refreshTokens() } catch { }
    const at = this.getAccessToken()
    const rt = this.getRefreshToken()
    if (!at || !rt) {
      return false
    }
    debug('[live] have at, rt', at, rt)
    if (at.valid && rt) {
      return true
    } else {
      try {
        await this.refreshTokens()
        return true
      } catch (e) {
        console.warn('Error refreshing token', e) // TODO: looks like an error happens here
        return false
      }
    }
  }

  async refreshTokens () {
    const rtoken = this.getRefreshToken()
    if (!rtoken) {
      throw new Error('Cannot refresh without refresh token')
    }

    const codeRequest = {
      method: 'post',
      body: new URLSearchParams({ scope: this.scopes, client_id: this.clientId, grant_type: 'refresh_token', refresh_token: rtoken.token }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      credentials: 'include' // This cookie handler does not work on node-fetch ...
    }

    const token = await fetch(authConstants.LiveTokenRequest, codeRequest).then(checkStatus)
    this.updateCachce(token)
    return token
  }

  getAccessToken () {
    const token = this.cache.token
    if (!token) return
    const until = new Date(token.obtainedOn + token.expires_in) - Date.now()
    const valid = until > 1000
    return { valid, until: until, token: token.access_token }
  }

  getRefreshToken () {
    const token = this.cache.token
    if (!token) return
    const until = new Date(token.obtainedOn + token.expires_in) - Date.now()
    const valid = until > 1000
    return { valid, until: until, token: token.refresh_token }
  }

  updateCachce (data) {
    data.obtainedOn = Date.now()
    this.cache.token = data
    fs.writeFileSync(this.cacheLocation, JSON.stringify(this.cache))
  }

  async authDeviceCode (deviceCodeCallback) {
    const acquireTime = Date.now()
    const codeRequest = {
      method: 'post',
      body: new URLSearchParams({ scope: this.scopes, client_id: this.clientId, response_type: 'device_code' }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      credentials: 'include' // This cookie handler does not work on node-fetch ...
    }

    debug('Requesting live device token', codeRequest)

    const cookies = []

    const res = await fetch(authConstants.LiveDeviceCodeRequest, codeRequest)
      .then(res => {
        if (res.status !== 200) {
          res.text().then(console.warn)
          throw Error('Failed to request live.com device code')
        }
        for (const cookie of Object.values(res.headers.raw()['set-cookie'])) {
          const [keyval] = cookie.split(';')
          cookies.push(keyval)
        }
        return res
      })
      .then(checkStatus).then(resp => {
        resp.message = `To sign in, use a web browser to open the page ${resp.verification_uri} and enter the code ${resp.user_code} to authenticate.`
        deviceCodeCallback(resp)
        return resp
      })
    const expireTime = acquireTime + (res.expires_in * 1000) - 100 /* for safety */

    this.polling = true
    while (this.polling && expireTime > Date.now()) {
      await new Promise(resolve => setTimeout(resolve, res.interval * 1000))
      try {
        const verifi = {
          method: 'post',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: cookies.join('; ')
          },
          body: new URLSearchParams({
            client_id: this.clientId,
            device_code: res.device_code,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          }).toString()
        }

        const token = await fetch(authConstants.LiveTokenRequest + '?client_id=' + this.clientId, verifi)
          .then(res => res.json()).then(res => {
            if (res.error) {
              if (res.error === 'authorization_pending') {
                debug('[live] Still waiting:', res.error_description)
              } else {
                throw Error(`Failed to acquire authorization code from device token (${res.error}) - ${res.error_description}`)
              }
            } else {
              return res
            }
          })
        if (!token) continue
        this.updateCachce(token)
        this.polling = false
        return { accessToken: token.access_token }
      } catch (e) {
        console.debug(e)
      }
    }
    this.polling = false
    throw Error('Authenitcation failed, timed out')
  }
}

// Manages Microsoft account tokens
class MsaTokenManager {
  constructor (msalConfig, scopes, cacheLocation) {
    this.msaClientId = msalConfig.auth.clientId
    this.scopes = scopes
    this.cacheLocation = cacheLocation || path.join(__dirname, './msa-cache.json')

    this.reloadCache()

    const beforeCacheAccess = async (cacheContext) => {
      cacheContext.tokenCache.deserialize(await fs.promises.readFile(this.cacheLocation, 'utf-8'))
    }

    const afterCacheAccess = async (cacheContext) => {
      if (cacheContext.cacheHasChanged) {
        await fs.promises.writeFile(this.cacheLocation, cacheContext.tokenCache.serialize())
      }
    }

    const cachePlugin = {
      beforeCacheAccess,
      afterCacheAccess
    }

    msalConfig.cache = {
      cachePlugin
    }
    this.msalApp = new msal.PublicClientApplication(msalConfig)
    this.msalConfig = msalConfig
  }

  reloadCache () {
    try {
      this.msaCache = require(this.cacheLocation)
    } catch (e) {
      this.msaCache = {}
      fs.writeFileSync(this.cacheLocation, JSON.stringify(this.msaCache))
    }
  }

  getUsers () {
    const accounts = this.msaCache.Account
    const users = []
    if (!accounts) return users
    for (const account of Object.values(accounts)) {
      users.push(account)
    }
    return users
  }

  getAccessToken () {
    const tokens = this.msaCache.AccessToken
    if (!tokens) return
    const account = Object.values(tokens).filter(t => t.client_id === this.msaClientId)[0]
    if (!account) {
      debug('[msa] No valid access token found', tokens)
      return
    }
    const until = new Date(account.expires_on * 1000) - Date.now()
    const valid = until > 1000
    return { valid, until: until, token: account.secret }
  }

  getRefreshToken () {
    const tokens = this.msaCache.RefreshToken
    if (!tokens) return
    const account = Object.values(tokens).filter(t => t.client_id === this.msaClientId)[0]
    if (!account) {
      debug('[msa] No valid refresh token found', tokens)
      return
    }
    return { token: account.secret }
  }

  async refreshTokens () {
    const rtoken = this.getRefreshToken()
    if (!rtoken) {
      throw new Error('Cannot refresh without refresh token')
    }
    const refreshTokenRequest = {
      refreshToken: rtoken.token,
      scopes: this.scopes
    }

    return new Promise((resolve, reject) => {
      this.msalApp.acquireTokenByRefreshToken(refreshTokenRequest).then((response) => {
        debug('[msa] refreshed token', JSON.stringify(response))
        this.reloadCache()
        resolve(response)
      }).catch((error) => {
        debug('[msa] failed to refresh', JSON.stringify(error))
        reject(error)
      })
    })
  }

  async verifyTokens () {
    if (this.forceRefresh) try { await this.refreshTokens() } catch { }
    const at = this.getAccessToken()
    const rt = this.getRefreshToken()
    if (!at || !rt) {
      return false
    }
    debug('[msa] have at, rt', at, rt)
    if (at.valid && rt) {
      return true
    } else {
      try {
        await this.refreshTokens()
        return true
      } catch (e) {
        console.warn('Error refreshing token', e) // TODO: looks like an error happens here
        return false
      }
    }
  }

  // Authenticate with device_code flow
  async authDeviceCode (dataCallback) {
    const deviceCodeRequest = {
      deviceCodeCallback: (resp) => {
        debug('[msa] device_code response: ', resp)
        dataCallback(resp)
      },
      scopes: this.scopes
    }

    return new Promise((resolve, reject) => {
      this.msalApp.acquireTokenByDeviceCode(deviceCodeRequest).then((response) => {
        debug('[msa] device_code resp', JSON.stringify(response))
        if (!this.msaCache.Account) this.msaCache.Account = { '': response.account }
        resolve(response)
      }).catch((error) => {
        console.warn('[msa] Error getting device code')
        console.debug(JSON.stringify(error))
        reject(error)
      })
    })
  }
}

// Manages Xbox Live tokens for xboxlive.com
class XboxTokenManager {
  constructor (relyingParty, ecKey, cacheLocation) {
    this.relyingParty = relyingParty
    this.key = ecKey
    jose.fromKeyLike(ecKey.publicKey).then(jwk => {
      this.jwk = { ...jwk, alg: 'ES256', use: 'sig' }
    })
    this.cacheLocation = cacheLocation || path.join(__dirname, './xbl-cache.json')
    try {
      this.cache = require(this.cacheLocation)
    } catch (e) {
      this.cache = {}
    }

    this.headers = { 'Cache-Control': 'no-store, must-revalidate, no-cache', 'x-xbl-contract-version': 1 }
  }

  getCachedUserToken () {
    const token = this.cache.userToken
    if (!token) return
    const until = new Date(token.NotAfter)
    const dn = Date.now()
    const remainingMs = until - dn
    const valid = remainingMs > 1000
    return { valid, token: token.Token, data: token }
  }

  getCachedXstsToken () {
    const token = this.cache.xstsToken
    if (!token) return
    const until = new Date(token.expiresOn)
    const dn = Date.now()
    const remainingMs = until - dn
    const valid = remainingMs > 1000
    return { valid, token: token.XSTSToken, data: token }
  }

  setCachedUserToken (data) {
    this.cache.userToken = data
    fs.writeFileSync(this.cacheLocation, JSON.stringify(this.cache))
  }

  setCachedXstsToken (data) {
    this.cache.xstsToken = data
    fs.writeFileSync(this.cacheLocation, JSON.stringify(this.cache))
  }

  async verifyTokens () {
    const ut = this.getCachedUserToken()
    const xt = this.getCachedXstsToken()
    if (!ut || !xt || this.forceRefresh) {
      return false
    }
    debug('[xbl] have user, xsts', ut, xt)
    if (ut.valid && xt.valid) {
      return true
    } else if (ut.valid && !xt.valid) {
      try {
        await this.getXSTSToken(ut.data)
        return true
      } catch (e) {
        return false
      }
    }
    return false
  }

  async getUserToken (msaAccessToken, azure) {
    debug('[xbl] obtaining xbox token with ms token', msaAccessToken)
    msaAccessToken = (azure ? 'd=' : 't=') + msaAccessToken
    const xblUserToken = await XboxLiveAuth.exchangeRpsTicketForUserToken(msaAccessToken)
    this.setCachedUserToken(xblUserToken)
    debug('[xbl] user token:', xblUserToken)
    return xblUserToken
  }

  // Make signature for the data being sent to server with our private key; server is sent our public key in plaintext
  sign (url, authorizationToken, payload) {
    // Their backend servers use Windows epoch timestamps, account for that. The server is very picky,
    // bad percision or wrong epoch may fail the request.
    const windowsTimestamp = (BigInt((Date.now() / 1000) | 0) + 11644473600n) * 10000000n
    // Only the /uri?and-query-string
    const pathAndQuery = new URL(url).pathname

    // Allocate the buffer for signature, TS, path, tokens and payload and NUL termination
    const allocSize = /* sig */ 5 + /* ts */ 9 + /* POST */ 5 + pathAndQuery.length + 1 + authorizationToken.length + 1 + payload.length + 1
    const buf = SmartBuffer.fromSize(allocSize)
    buf.writeInt32BE(1) // Policy Version
    buf.writeUInt8(0)
    buf.writeBigUInt64BE(windowsTimestamp)
    buf.writeUInt8(0) // null term
    buf.writeStringNT('POST')
    buf.writeStringNT(pathAndQuery)
    buf.writeStringNT(authorizationToken)
    buf.writeStringNT(payload)

    // Get the signature from the payload
    const signature = crypto.sign('SHA256', buf.toBuffer(), { key: this.key.privateKey, dsaEncoding: 'ieee-p1363' })

    const header = SmartBuffer.fromSize(signature.length + 12)
    header.writeInt32BE(1) // Policy Version
    header.writeBigUInt64BE(windowsTimestamp)
    header.writeBuffer(signature) // Add signature at end of header

    return header.toBuffer()
  }

  // If we don't need Xbox Title Authentication, we can have xboxreplay lib
  // handle the auth, otherwise we need to build the request ourselves with
  // the extra token data.
  async getXSTSToken (xblUserToken, deviceToken, titleToken) {
    if (deviceToken && titleToken) return this.getXSTSTokenWithTitle(xblUserToken, deviceToken, titleToken)

    debug('[xbl] obtaining xsts token with xbox user token (with XboxReplay)', xblUserToken.Token)
    const xsts = await XboxLiveAuth.exchangeUserTokenForXSTSIdentity(xblUserToken.Token, { XSTSRelyingParty: this.relyingParty, raw: false })
    this.setCachedXstsToken(xsts)
    debug('[xbl] xsts', xsts)
    return xsts
  }

  async getXSTSTokenWithTitle (xblUserToken, deviceToken, titleToken, optionalDisplayClaims) {
    const userToken = xblUserToken.Token
    debug('[xbl] obtaining xsts token with xbox user token', userToken)

    const payload = {
      RelyingParty: this.relyingParty,
      TokenType: 'JWT',
      Properties: {
        UserTokens: [userToken],
        DeviceToken: deviceToken,
        TitleToken: titleToken,
        OptionalDisplayClaims: optionalDisplayClaims,
        ProofKey: this.jwk,
        SandboxId: 'RETAIL'
      }
    }

    const body = JSON.stringify(payload)
    const signature = this.sign(authConstants.XstsAuthorize, '', body).toString('base64')

    const headers = { ...this.headers, Signature: signature }

    const ret = await fetch(authConstants.XstsAuthorize, { method: 'post', headers, body }).then(checkStatus)
    const xsts = {
      userXUID: ret.DisplayClaims.xui[0].xid || null,
      userHash: ret.DisplayClaims.xui[0].uhs,
      XSTSToken: ret.Token,
      expiresOn: ret.NotAfter
    }

    this.setCachedXstsToken(xsts)
    debug('[xbl] xsts', xsts)
    return xsts
  }

  /**
   * Requests an Xbox Live-related device token that uniquely links the XToken (aka xsts token)
   * @param {{ DeviceType, Version }} asDevice The hardware type and version to auth as, for example Android or Nintendo
   */
  async getDeviceToken (asDevice) {
    const payload = {
      Properties: {
        AuthMethod: 'ProofOfPossession',
        Id: `{${nextUUID()}}`,
        DeviceType: asDevice.DeviceType || 'Android',
        SerialNumber: `{${nextUUID()}}`,
        Version: asDevice.Version || '10',
        ProofKey: this.jwk
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    }

    const body = JSON.stringify(payload)

    const signature = this.sign(authConstants.XboxDeviceAuth, '', body).toString('base64')

    const headers = { ...this.headers, Signature: signature }

    const ret = await fetch(authConstants.XboxDeviceAuth, { method: 'post', headers, body }).then(checkStatus)
    debug('Xbox Device Token', ret)
    return ret.Token
  }

  // This *only* works with live.com auth
  async getTitleToken (msaAccessToken, deviceToken) {
    const payload = {
      Properties: {
        AuthMethod: 'RPS',
        DeviceToken: deviceToken,
        RpsTicket: 't=' + msaAccessToken,
        SiteName: 'user.auth.xboxlive.com',
        ProofKey: this.jwk
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    }
    const body = JSON.stringify(payload)
    const signature = this.sign(authConstants.XboxTitleAuth, '', body).toString('base64')

    const headers = { ...this.headers, Signature: signature }

    const ret = await fetch(authConstants.XboxTitleAuth, { method: 'post', headers, body }).then(checkStatus)
    debug('Xbox Title Token', ret)
    return ret.Token
  }
}

// Manages Minecraft tokens for sessionserver.mojang.com
class MinecraftTokenManager {
  constructor (clientPublicKey, cacheLocation) {
    this.clientPublicKey = clientPublicKey
    this.cacheLocation = cacheLocation || path.join(__dirname, './bed-cache.json')
    try {
      this.cache = require(this.cacheLocation)
    } catch (e) {
      this.cache = {}
    }
  }

  getCachedAccessToken () {
    const token = this.cache.mca
    debug('[mc] token cache', this.cache)
    if (!token) return
    debug('Auth token', token)
    const jwt = token.chain[0]
    const [header, payload, signature] = jwt.split('.').map(k => Buffer.from(k, 'base64')) // eslint-disable-line

    const body = JSON.parse(String(payload))
    const expires = new Date(body.exp * 1000)
    const remainingMs = expires - Date.now()
    const valid = remainingMs > 1000
    return { valid, until: expires, chain: token.chain }
  }

  setCachedAccessToken (data) {
    data.obtainedOn = Date.now()
    this.cache.mca = data
    fs.writeFileSync(this.cacheLocation, JSON.stringify(this.cache))
  }

  async verifyTokens () {
    const at = this.getCachedAccessToken()
    if (!at || this.forceRefresh) {
      return false
    }
    debug('[mc] have user access token', at)
    if (at.valid) {
      return true
    }
    return false
  }

  async getAccessToken (clientPublicKey, xsts) {
    debug('[mc] authing to minecraft', clientPublicKey, xsts)
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'node-minecraft-protocol',
      Authorization: `XBL3.0 x=${xsts.userHash};${xsts.XSTSToken}`
    }
    const MineServicesResponse = await fetch(authConstants.MinecraftAuth, {
      method: 'post',
      headers,
      body: JSON.stringify({ identityPublicKey: clientPublicKey })
    }).then(checkStatus)

    debug('[mc] mc auth response', MineServicesResponse)
    this.setCachedAccessToken(MineServicesResponse)
    return MineServicesResponse
  }
}

function checkStatus (res) {
  if (res.ok) { // res.status >= 200 && res.status < 300
    return res.json()
  } else {
    debug('Request fail', res)
    throw Error(res.statusText)
  }
}

module.exports = { LiveTokenManager, MsaTokenManager, XboxTokenManager, MinecraftTokenManager }
