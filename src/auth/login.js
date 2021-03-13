const fs = require('fs')
const JWT = require('jsonwebtoken')
const DataProvider = require('../../data/provider')
const ecPem = require('ec-pem')
const curve = 'secp384r1'

module.exports = (client, server, options) => {
  const skinGeom = fs.readFileSync(DataProvider(options.protocolVersion).getPath('skin_geom.txt'), 'utf-8')

  client.createClientChain = (mojangKey) => {
    mojangKey = mojangKey || require('./constants').PUBLIC_KEY
    const alice = client.ecdhKeyPair
    const alicePEM = ecPem(alice, curve) // https://github.com/nodejs/node/issues/15116#issuecomment-384790125
    const alicePEMPrivate = alicePEM.encodePrivateKey()

    const token = JWT.sign({
      identityPublicKey: mojangKey,
      certificateAuthority: true
    }, alicePEMPrivate, { algorithm: 'ES384', header: { x5u: client.clientX509 } })

    client.clientIdentityChain = token
    client.createClientUserChain(alicePEMPrivate)
  }

  client.createClientUserChain = (privateKey) => {
    let payload = {
      ServerAddress: options.hostname,
      ThirdPartyName: client.profile.name,
      DeviceOS: client.session?.deviceOS || 1,
      GameVersion: options.version || '1.16.201',
      ClientRandomId: Date.now(), // TODO make biggeer
      DeviceId: '2099de18-429a-465a-a49b-fc4710a17bb3', // TODO random
      LanguageCode: 'en_GB', // TODO locale
      AnimatedImageData: [],
      PersonaPieces: [],
      PieceTintColours: [],
      SelfSignedId: '78eb38a6-950e-3ab9-b2cf-dd849e343701',
      SkinId: '5eb65f73-af11-448e-82aa-1b7b165316ad.persona-e199672a8c1a87e0-0',
      SkinData: 'AAAAAA==',
      SkinResourcePatch: 'ewogICAiZ2VvbWV0cnkiIDogewogICAgICAiYW5pbWF0ZWRfMTI4eDEyOCIgOiAiZ2VvbWV0cnkuYW5pbWF0ZWRfMTI4eDEyOF9wZXJzb25hLWUxOTk2NzJhOGMxYTg3ZTAtMCIsCiAgICAgICJhbmltYXRlZF9mYWNlIiA6ICJnZW9tZXRyeS5hbmltYXRlZF9mYWNlX3BlcnNvbmEtZTE5OTY3MmE4YzFhODdlMC0wIiwKICAgICAgImRlZmF1bHQiIDogImdlb21ldHJ5LnBlcnNvbmFfZTE5OTY3MmE4YzFhODdlMC0wIgogICB9Cn0K',
      SkinGeometryData: skinGeom,
      SkinImageHeight: 1,
      SkinImageWidth: 1,
      ArmSize: 'wide',
      CapeData: '',
      CapeId: '',
      CapeImageHeight: 0,
      CapeImageWidth: 0,
      CapeOnClassicSkin: false,
      PlatformOfflineId: '',
      PlatformOnlineId: '', // chat
      // a bunch of meaningless junk
      CurrentInputMode: 1,
      DefaultInputMode: 1,
      DeviceModel: '',
      GuiScale: -1,
      UIProfile: 0,
      TenantId: '',
      PremiumSkin: false,
      PersonaSkin: false,
      PieceTintColors: [],
      SkinAnimationData: '',
      ThirdPartyNameOnly: false,
      SkinColor: '#ffffcd96'
    }
    payload = require('./logPack.json')
    const customPayload = options.userData || {}
    payload = { ...payload, ...customPayload }

    client.clientUserChain = JWT.sign(payload, privateKey,
      { algorithm: 'ES384', header: { x5u: client.clientX509 } })
  }
}
