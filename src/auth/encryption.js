const JWT = require('jsonwebtoken')
const crypto = require('crypto')
const { Ber } = require('asn1')
const ecPem = require('ec-pem')
const fs = require('fs')
const DataProvider = require('../../data/provider')

const SALT = '🧂'
const curve = 'secp384r1'

function Encrypt (client, server, options) {
  const skinGeom = fs.readFileSync(DataProvider(options.protocolVersion).getPath('skin_geom.txt'), 'utf-8')

  client.ecdhKeyPair = crypto.createECDH(curve)
  client.ecdhKeyPair.generateKeys()
  client.clientX509 = writeX509PublicKey(client.ecdhKeyPair.getPublicKey())

  function startClientboundEncryption (publicKey) {
    console.warn('[encrypt] Pub key base64: ', publicKey)
    const pubKeyBuf = readX509PublicKey(publicKey.key)

    const alice = client.ecdhKeyPair
    const alicePEM = ecPem(alice, curve) // https://github.com/nodejs/node/issues/15116#issuecomment-384790125
    const alicePEMPrivate = alicePEM.encodePrivateKey()
    // Shared secret from bob's public key + our private key
    client.sharedSecret = alice.computeSecret(pubKeyBuf)

    // Secret hash we use for packet encryption:
    // From the public key of the remote and the private key
    // of the local, a shared secret is generated using ECDH.
    // The secret key bytes are then computed as
    // sha256(server_token + shared_secret). These secret key
    //  bytes are 32 bytes long.
    const secretHash = crypto.createHash('sha256')
    secretHash.update(SALT)
    secretHash.update(client.sharedSecret)
    console.log('[encrypt] Shared secret', client.sharedSecret)

    client.secretKeyBytes = secretHash.digest()
    console.log('[encrypt] Shared hash', client.secretKeyBytes)
    const x509 = writeX509PublicKey(alice.getPublicKey())
    const token = JWT.sign({
      salt: toBase64(SALT),
      signedToken: alice.getPublicKey('base64')
    }, alicePEMPrivate, { algorithm: 'ES384', header: { x5u: x509 } })

    client.write('server_to_client_handshake', {
      token: token
    })

    // The encryption scheme is AES/CFB8/NoPadding with the
    // secret key being the result of the sha256 above and
    // the IV being the first 16 bytes of this secret key.
    const initial = client.secretKeyBytes.slice(0, 16)
    client.startEncryption(initial)
  }

  function startServerboundEncryption (token) {
    console.warn('[encrypt] Starting serverbound encryption', token)
    const jwt = token?.token
    if (!jwt) {
      // TODO: allow connecting to servers without encryption
      throw Error('Server did not return a valid JWT, cannot start encryption!')
    }
    // TODO: Should we do some JWT signature validation here? Seems pointless
    const alice = client.ecdhKeyPair
    const [header, payload] = jwt.split('.').map(k => Buffer.from(k, 'base64'))
    const head = JSON.parse(String(header))
    const body = JSON.parse(String(payload))
    const serverPublicKey = readX509PublicKey(head.x5u)
    client.sharedSecret = alice.computeSecret(serverPublicKey)
    console.log('[encrypt] Shared secret', client.sharedSecret)

    const salt = Buffer.from(body.salt, 'base64')

    const secretHash = crypto.createHash('sha256')
    secretHash.update(salt)
    secretHash.update(client.sharedSecret)

    client.secretKeyBytes = secretHash.digest()
    console.log('[encrypt] Shared hash', client.secretKeyBytes)
    const initial = client.secretKeyBytes.slice(0, 16)
    client.startEncryption(initial)

    // It works! First encrypted packet :)
    client.write('client_to_server_handshake', {})
    this.emit('join')
  }

  client.on('server.client_handshake', startClientboundEncryption)
  client.on('client.server_handshake', startServerboundEncryption)

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

function toBase64 (string) {
  return Buffer.from(string).toString('base64')
}

function readX509PublicKey (key) {
  const reader = new Ber.Reader(Buffer.from(key, 'base64'))
  reader.readSequence()
  reader.readSequence()
  reader.readOID() // Hey, I'm an elliptic curve
  reader.readOID() // This contains the curve type, could be useful
  return Buffer.from(reader.readString(Ber.BitString, true)).slice(1)
}

function writeX509PublicKey (key) {
  const writer = new Ber.Writer()
  writer.startSequence()
  writer.startSequence()
  writer.writeOID('1.2.840.10045.2.1')
  writer.writeOID('1.3.132.0.34')
  writer.endSequence()
  writer.writeBuffer(Buffer.concat([Buffer.from([0x00]), key]), Ber.BitString)
  writer.endSequence()
  return writer.buffer.toString('base64')
}

module.exports = {
  readX509PublicKey,
  writeX509PublicKey,
  Encrypt
}
