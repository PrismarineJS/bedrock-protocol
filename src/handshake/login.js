const JWT = require('jsonwebtoken')
const { nextUUID } = require('../datatypes/util')
const { PUBLIC_KEY } = require('./constants')
const algorithm = 'ES384'

module.exports = (client, server, options) => {
  const skinData = require('minecraft-data')('bedrock_' + options.version).defaultSkin

  client.createClientChain = (mojangKey, offline) => {
    const privateKey = client.ecdhKeyPair.privateKey

    let token
    if (offline) {
      const payload = {
        extraData: {
          displayName: client.username,
          identity: client.profile.uuid,
          titleId: '89692877',
          XUID: '0'
        },
        certificateAuthority: true,
        identityPublicKey: client.clientX509
      }
      token = JWT.sign(payload, privateKey, { algorithm, notBefore: 0, issuer: 'self', expiresIn: 60 * 60, header: { x5u: client.clientX509, typ: undefined } })
    } else {
      token = JWT.sign({
        identityPublicKey: mojangKey || PUBLIC_KEY,
        certificateAuthority: true
      }, privateKey, { algorithm, header: { x5u: client.clientX509, typ: undefined } })
    }

    client.clientIdentityChain = token
    client.createClientUserChain(privateKey)
  }

  client.createClientUserChain = (privateKey) => {
    let payload = {
      ...skinData,

      ClientRandomId: Date.now(),
      CurrentInputMode: 1,
      DefaultInputMode: 1,
      DeviceId: nextUUID(),
      DeviceModel: 'PrismarineJS',
      DeviceOS: client.session?.deviceOS || 7,
      GameVersion: options.version || '1.16.201',
      GuiScale: -1,
      LanguageCode: 'en_GB', // TODO locale
      GraphicsMode: 1, // 1:simple, 2:fancy, 3:advanced, 4:ray_traced

      PlatformOfflineId: '',
      PlatformOnlineId: '', // chat
      // PlayFabID is the PlayFab ID produced for the skin. PlayFab is the company that hosts the Marketplace,
      // skins and other related features from the game. This ID is the ID of the skin used to store the skin
      // inside of PlayFab.The playfab ID is always lowercased.
      PlayFabId: nextUUID().replace(/-/g, '').slice(0, 16).toLowerCase(), // 1.16.210

      SelfSignedId: nextUUID(),
      ServerAddress: `${options.host}:${options.port}`,

      ThirdPartyName: client.profile.name, // Gamertag
      ThirdPartyNameOnly: client.versionGreaterThanOrEqualTo('1.21.90') ? undefined : false,
      UIProfile: 0,

      IsEditorMode: false,
      TrustedSkin: client.versionGreaterThanOrEqualTo('1.19.20') ? false : undefined,
      OverrideSkin: client.versionGreaterThanOrEqualTo('1.19.62') ? false : undefined,
      CompatibleWithClientSideChunkGen: client.versionGreaterThanOrEqualTo('1.19.80') ? false : undefined,

      MaxViewDistance: client.versionGreaterThanOrEqualTo('1.21.42') ? 0 : undefined,
      MemoryTier: client.versionGreaterThanOrEqualTo('1.21.42') ? 0 : undefined,
      PlatformType: client.versionGreaterThanOrEqualTo('1.21.42') ? 0 : undefined
    }
    const customPayload = options.skinData || {}
    payload = { ...payload, ...customPayload }
    payload.ServerAddress = `${options.host}:${options.port}`

    client.clientUserChain = JWT.sign(payload, privateKey, { algorithm, header: { x5u: client.clientX509, typ: undefined }, noTimestamp: true /* pocketmine.. */ })
  }
}
