const fs = require('fs')
const JWT = require('jsonwebtoken')
const DataProvider = require('../../data/provider')
const ecPem = require('ec-pem')
const curve = 'secp384r1'
const { nextUUID } = require('../datatypes/util')

module.exports = (client, server, options) => {
  const skinGeom = fs.readFileSync(DataProvider(options.protocolVersion).getPath('skin_geom.txt'), 'utf-8')

  client.createClientChain = (mojangKey, offline) => {
    mojangKey = mojangKey || require('./constants').PUBLIC_KEY
    const alice = client.ecdhKeyPair
    const alicePEM = ecPem(alice, curve) // https://github.com/nodejs/node/issues/15116#issuecomment-384790125
    const alicePEMPrivate = alicePEM.encodePrivateKey()

    let token
    if (offline) {
      const payload = {
        extraData: {
          displayName: client.username,
          identity: client.profile.uuid,
          titleId: '89692877'
        },
        certificateAuthority: true,
        identityPublicKey: client.clientX509
      }
      token = JWT.sign(payload, alicePEMPrivate, { algorithm: 'ES384', notBefore: 0, issuer: 'self', expiresIn: 60 * 60, header: { x5u: client.clientX509 } })
    } else {
      token = JWT.sign({
        identityPublicKey: mojangKey,
        certificateAuthority: true
      }, alicePEMPrivate, { algorithm: 'ES384', header: { x5u: client.clientX509 } })
    }

    client.clientIdentityChain = token
    client.createClientUserChain(alicePEMPrivate)
  }

  client.createClientUserChain = (privateKey) => {
    let payload = {
      AnimatedImageData: [],
      ArmSize: 'wide',
      CapeData: '',
      CapeId: '',
      CapeImageHeight: 0,
      CapeImageWidth: 0,
      CapeOnClassicSkin: false,
      ClientRandomId: Date.now(),
      CurrentInputMode: 1,
      DefaultInputMode: 1,
      DeviceId: nextUUID(),
      DeviceModel: '',
      DeviceOS: client.session?.deviceOS || 7,
      GameVersion: options.version || '1.16.201',
      GuiScale: -1,
      LanguageCode: 'en_GB', // TODO locale
      PersonaPieces: [],
      PersonaSkin: true,
      PieceTintColors: [],
      PlatformOfflineId: '',
      PlatformOnlineId: '', // chat
      // PlayFabID is the PlayFab ID produced for the skin. PlayFab is the company that hosts the Marketplace,
      // skins and other related features from the game. This ID is the ID of the skin used to store the skin
      // inside of PlayFab.
      PlayFabId: '5eb65f73-af11-448e-82aa-1b7b165316ad.persona-e199672a8c1a87e0-0', // 1.16.210
      PremiumSkin: false,
      SelfSignedId: '78eb38a6-950e-3ab9-b2cf-dd849e343702',
      ServerAddress: `${options.hostname}:${options.port}`,
      SkinAnimationData: '',
      SkinColor: '#ffffcd96',
      SkinData: 'AAAAAA==',
      SkinGeometryData: skinGeom,
      SkinId: '5eb65f73-af11-448e-82aa-1b7b165316ad.persona-e199672a8c1a87e0-0',
      SkinImageHeight: 1,
      SkinImageWidth: 1,
      SkinResourcePatch: '',
      ThirdPartyName: client.profile.name,
      ThirdPartyNameOnly: false,
      UIProfile: 0
    }
    const customPayload = options.userData || {}
    payload = { ...payload, ...customPayload }

    client.clientUserChain = JWT.sign(payload, privateKey,
      { algorithm: 'ES384', header: { x5u: client.clientX509 } })
  }
}
