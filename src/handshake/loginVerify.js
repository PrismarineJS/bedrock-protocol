const JWT = require('jsonwebtoken')
const constants = require('./constants')
const debug = require('debug')('minecraft-protocol')
const crypto = require('crypto')

module.exports = (client, server, options) => {
  // Refer to the docs:
  // https://web.archive.org/web/20180917171505if_/https://confluence.yawk.at/display/PEPROTOCOL/Game+Packets#GamePackets-Login

  const getDER = b64 => crypto.createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' })

  // 26.10, March 2026+
  function parseTokenData (token) {
    function normalizeToken (token) {
      return token.replace(/^MCToken\s+/i, '')
    }

    const normalized = normalizeToken(token)
    
    // For self-signed offline tokens, just decode without verifying signature
    // (matches Java OFFLINE_CONSUMER which skips all signature validation)
    const decoded = JWT.decode(normalized)
    if (!decoded || typeof decoded !== 'object') throw new Error('Invalid login token')

    const payload = decoded || {}
    const key = payload.cpk || payload.clientPublicKey
    return {
      key,
      data: {
        extraData: {
          XUID: payload.xid || payload.XUID || payload.xuid || '0',
          displayName: payload.xname || payload.displayName || 'Player',
          identity: payload.identity,
          PlayFabID: payload.pfbid || payload.playFabId || payload.PlayFabID,
          PlayFabTitleID: payload.pfbtid || payload.playFabTitleId || payload.PlayFabTitleID
        }
      }
    }
  }

  function verifyAuth (chain, token) {
    debug('=== verifyAuth START ===')
    debug('Input: chain type =', Array.isArray(chain) ? 'array' : typeof chain, ', chain length =', chain?.length, ', token length =', token?.length)
    
    // TokenPayload (modern): empty chain + authToken
    // In v818+, when TokenPayload is used, chain comes empty and token has the OIDC JWT
    if ((!chain || chain.length === 0) && token) {
      debug('TokenPayload detected: validating OIDC token')
      // For offline mode, just decode the token without verifying signature
      if (options.offline) {
        debug('Offline mode: decoding token without signature verification')
        const decoded = JWT.decode(token)
        if (!decoded) throw new Error('Invalid offline token')
        const resultData = {
          extraData: {
            displayName: decoded.xname || decoded.displayName || 'Player',
            identity: decoded.identity,
            XUID: decoded.xid || decoded.XUID || decoded.xuid || '0',
            xuid: decoded.xuid || decoded.XUID || decoded.xid || '0',
            PlayFabID: decoded.pfbid || decoded.playFabId || decoded.PlayFabID,
            PlayFabTitleID: decoded.pfbtid || decoded.playFabTitleId || decoded.PlayFabTitleID
          }
        }
        debug('Token decoded offline: displayName =', resultData.extraData.displayName)
        const finalKey = decoded.cpk || decoded.clientPublicKey
        return { key: finalKey, data: resultData }
      } else {
        // Online mode: would need to validate against Mojang's JWKS (not implemented here)
        // For now, just decode and trust it (implement proper OIDC validation if needed)
        debug('Online mode: decoding token (OIDC validation not yet implemented)')
        const decoded = JWT.decode(token)
        if (!decoded) throw new Error('Invalid token')
        const resultData = {
          extraData: {
            displayName: decoded.xname || decoded.displayName || 'Player',
            identity: decoded.identity,
            XUID: decoded.xid || decoded.XUID || decoded.xuid || '0',
            xuid: decoded.xuid || decoded.XUID || decoded.xid || '0',
            PlayFabID: decoded.pfbid || decoded.playFabId || decoded.PlayFabID,
            PlayFabTitleID: decoded.pfbtid || decoded.playFabTitleId || decoded.PlayFabTitleID
          }
        }
        debug('Token decoded online: displayName =', resultData.extraData.displayName)
        const finalKey = decoded.cpk || decoded.clientPublicKey
        return { key: finalKey, data: resultData }
      }
    }

    // According to reference implementation, the chain should be either
    // length 1 (offline/proxied) or length 3 (full chain).
    if (!chain || chain.length === 0) throw new Error('Empty certificate chain')

    debug('verifyAuth: chain length =', chain.length)

    if (chain.length === 1) {
      // Offline/proxied case: do not validate signature, just return payload
      debug('verifyAuth: processing single-entry chain (offline/proxied)')
      const decoded = JWT.decode(chain[0])
      if (!decoded) throw new Error('Invalid single-entry chain')
      
      // Transform payload to match expected structure
      const resultData = {
        extraData: {
          displayName: decoded.displayName || decoded.xname || 'Player',
          identity: decoded.identity,
          XUID: decoded.XUID || decoded.xid || '0',
          xuid: decoded.xuid || decoded.XUID || decoded.xid || '0',
          PlayFabID: decoded.PlayFabID || decoded.playFabId || decoded.pfbid,
          PlayFabTitleID: decoded.PlayFabTitleID || decoded.playFabTitleId || decoded.pfbtid
        }
      }
      const key = decoded.identityPublicKey || decoded.clientPublicKey
      debug('verifyAuth: offline chain decoded, displayName =', resultData.extraData.displayName, ', key present =', !!key)
      return { key, data: resultData }
    }

    if (chain.length !== 3) {
      throw new Error('Unexpected login chain length: ' + chain.length)
    }

    // Full chain validation (length === 3)
    // Logic from Java EncryptionUtils.validateChain():
    // Each token[i] is verified using a key that becomes the expected key for token[i+1]
    // First token is verified using its own header.x5u
    // Token[i] signature is verified, then identityPublicKey becomes the key for token[i+1]
    debug('verifyAuth: processing full 3-entry chain')
    let currentKeyB64 = null  // Current key in base64 form
    let finalKey = null
    let parsedPayload = {}

    for (let i = 0; i < 3; i++) {
      const token = chain[i]
      const headerX5u = getX5U(token)
      debug('verifyAuth: chain[' + i + '] x5u =', headerX5u.substring(0, 20) + '...')

      // Get the public key from header to verify this token
      let expectedKeyB64 = headerX5u
      
      // On first iteration, establish the key. On subsequent iterations, verify it matches.
      if (currentKeyB64 === null) {
        currentKeyB64 = expectedKeyB64
        debug('verifyAuth: established initial key from token[0] header')
      } else if (expectedKeyB64 !== currentKeyB64) {
        // The header key must match the previous token's identityPublicKey
        debug('verifyAuth: ERROR - expected key mismatch. current=', currentKeyB64.substring(0, 20), 'expected=', expectedKeyB64.substring(0, 20))
        throw new Error('Received broken chain: signature key mismatch')
      }

      // Verify signature using the current key
      debug('verifyAuth: verifying signature for token ' + i)
      let decoded
      try {
        const pubKey = getDER(currentKeyB64)
        decoded = JWT.verify(token, pubKey, { algorithms: ['ES384'] })
      } catch (e) {
        debug('verifyAuth: signature verification failed:', e.message)
        throw new Error('Chain signature verification failed: ' + e.message)
      }
      debug('verifyAuth: token ' + i + ' signature verified')

      // Token[1] (second entry, index 1) must be signed by Mojang's public key
      if (i === 1) {
        if (currentKeyB64 !== constants.PUBLIC_KEY) {
          debug('verifyAuth: ERROR - token[1] not signed by Mojang. key=', currentKeyB64.substring(0, 20))
          throw new Error('The chain is not signed by Mojang')
        }
        debug('verifyAuth: verified token[1] signed by Mojang')
      }

      // Save payload (return the last one)
      parsedPayload = decoded

      // For next iteration the identityPublicKey becomes the current key
      if (decoded.identityPublicKey) {
        finalKey = decoded.identityPublicKey
        currentKeyB64 = decoded.identityPublicKey
        debug('verifyAuth: chain[' + i + '] identityPublicKey becomes next key')
      } else if (i < 2) {
        // All tokens except possibly the last one must have identityPublicKey
        throw new Error('Chain token ' + i + ' missing identityPublicKey')
      }
    }

    // transform payload to match expected structure with extraData
    const resultData = {
      extraData: {
        displayName: parsedPayload.displayName || parsedPayload.xname || 'Player',
        identity: parsedPayload.identity,
        XUID: parsedPayload.XUID || parsedPayload.xid || '0',
        xuid: parsedPayload.xuid || parsedPayload.XUID || parsedPayload.xid || '0',
        PlayFabID: parsedPayload.PlayFabID || parsedPayload.playFabId || parsedPayload.pfbid,
        PlayFabTitleID: parsedPayload.PlayFabTitleID || parsedPayload.playFabTitleId || parsedPayload.pfbtid
      }
    }
    
    // If finalKey wasn't set from loop, try to get it from parsed payload
    if (!finalKey && parsedPayload.identityPublicKey) {
      finalKey = parsedPayload.identityPublicKey
    }
    
    debug('verifyAuth: chain verification complete, displayName =', resultData.extraData.displayName, ', key present =', !!finalKey)
    return { key: finalKey, data: resultData }
  }

  function verifySkin (publicKey, token) {
    // In offline mode, publicKey may be null just decode without verification
    if (!publicKey) {
      return JWT.decode(token)
    }
    // publicKey is a base64 string
    const pubKey = getDER(publicKey)
    const decoded = JWT.verify(token, pubKey, { algorithms: ['ES384'] })
    return decoded
  }

  client.decodeLoginJWT = (authTokens, skinTokens, authToken = '') => {
    debug('decodeLoginJWT: authTokens length =', authTokens?.length, ', authToken length =', authToken?.length)
    const { key, data } = verifyAuth(authTokens, authToken)
    const keyDisplay = typeof key === 'string' ? key.substring(0, 20) + '...' : 'null'
    const displayName = data?.extraData?.displayName
    debug('verifyAuth returned: key =', keyDisplay, ', displayName =', displayName)
    
    debug('verifySkin: processing skin token with key =', keyDisplay)
    const skinData = verifySkin(key, skinTokens)
    debug('verifySkin returned SkinId:', skinData?.SkinId?.substring(0, 30))
    
    return { key, userData: data, skinData }
  }

  client.encodeLoginJWT = (localChain, mojangChain) => {
    const chains = []
    chains.push(localChain)
    for (const chain of mojangChain) {
      chains.push(chain)
    }
    return chains
  }
}

function getX5U (token) {
  const [header] = token.split('.')
  const hdec = Buffer.from(header, 'base64').toString('utf-8')
  const hjson = JSON.parse(hdec)
  return hjson.x5u
}
