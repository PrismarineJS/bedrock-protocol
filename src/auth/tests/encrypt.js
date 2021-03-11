const crypto = require('crypto')
const JWT = require('jsonwebtoken')
const constants = require('./constants')
const { Ber } = require('asn1')
const ec_pem = require('ec-pem')

// function Encrypt(client, options) {
//     this.startClientboundEncryption = (pubKeyBuf) => {

//     }
//     client.on('start_encrypt', this.startClientboundEncryption)
// }

// module.exports = Encrypt

// Server -> Client : sent right after the client sends us a LOGIN_PACKET so
// we can start the encryption process
// @param {key} - The key from the client Login Packet final  JWT chain
function startClientboundEncryption (pubKeyBuf) {
  // create our ecdh keypair
  const type = 'secp256k1'
  const alice = crypto.createECDH(type)
  const aliceKey = alice.generateKeys()
  const alicePublicKey = aliceKey.toString('base64')
  const alicePrivateKey = mcPubKeyToPem(alice.getPrivateKey('base64'))
  // get our secret key hex encoded
  // const aliceSecret = alice.computeSecret(pubKeyBuf, null, 'hex')

  // (yawkat:)
  // From the public key of the remote and the private key of the local,
  // a shared secret is generated using ECDH. The secret key bytes are
  // then computed as sha256(server_token + shared_secret). These secret
  // key bytes are 32 bytes long.
  const salt = Buffer.from('', 'utf-8')
  const secret = crypto.createHash('sha256').update(Buffer.concat([salt, pubKeyBuf])).digest()
  console.log('alice', alicePrivateKey)
  const pem = mcPubKeyToPem(alice.getPrivateKey().toString('base64'))
  console.log('pem', pem)

  const token = JWT.sign({
    salt,
    signedToken: alicePublicKey
  }, pem, { algorithm: 'ES384' })

  console.log('Token', token)

  // get our Secret Bytes from the secret key

  // alice.setPrivateKey(
  //     crypto.createHash('sha256').update('alice', 'utf8').digest()
  // )

  // 						using (var sha = SHA256.Create())
  // 						{
  // 							secret = sha.ComputeHash(secretPrepend.Concat(agreement.CalculateAgreement(remotePublicKey).ToByteArrayUnsigned()).ToArray());
  // 						}

  const bob = crypto.createECDH('secp256k1')

  // URI x5u = URI.create(Base64.getEncoder().encodeToString(serverKeyPair.getPublic().getEncoded()));

  // JWTClaimsSet claimsSet = new JWTClaimsSet.Builder().claim("salt", Base64.getEncoder().encodeToString(token)).build();
  // SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES384).x509CertURL(x5u).build(), claimsSet);

  // signJwt(jwt, (ECPrivateKey) serverKeyPair.getPrivate());

  // return jwt;
}

function testECDH () {
  const crypto = require('crypto')
  const alice = crypto.createECDH('secp256k1')
  const bob = crypto.createECDH('secp256k1')

  // Note: This is a shortcut way to specify one of Alice's previous private
  // keys. It would be unwise to use such a predictable private key in a real
  // application.
  alice.setPrivateKey(
    crypto.createHash('sha256').update('alice', 'utf8').digest()
  )

  // Bob uses a newly generated cryptographically strong
  // pseudorandom key pair bob.generateKeys();

  const alice_secret = alice.computeSecret(bob.getPublicKey(), null, 'hex')
  const bob_secret = bob.computeSecret(alice.getPublicKey(), null, 'hex')

  // alice_secret and bob_secret should be the same shared secret value
  console.log(alice_secret === bob_secret)
}

function testECDH2 () {
  const type = 'secp256k1'
  const alice = crypto.createECDH(type)
  const aliceKey = alice.generateKeys()

  // Generate Bob's keys...
  const bob = crypto.createECDH(type)
  const bobKey = bob.generateKeys()

  console.log('\nAlice private key:\t', alice.getPrivateKey().toString('hex'))
  console.log('Alice public key:\t', aliceKey.toString('hex'))

  console.log('\nBob private key:\t', bob.getPrivateKey().toString('hex'))
  console.log('Bob public key:\t', bobKey.toString('hex'))

  // Exchange and generate the secret...
  const aliceSecret = alice.computeSecret(bobKey)
  const bobSecret = bob.computeSecret(aliceKey)

  console.log('\nAlice shared key:\t', aliceSecret.toString('hex'))
  console.log('Bob shared key:\t\t', bobSecret.toString('hex'))
  // wow it actually works?!
}

function mcPubKeyToPem (mcPubKeyBuffer) {
  console.log(mcPubKeyBuffer)
  if (mcPubKeyBuffer[0] == '-') return mcPubKeyBuffer
  let pem = '-----BEGIN PUBLIC KEY-----\n'
  let base64PubKey = mcPubKeyBuffer.toString('base64')
  const maxLineLength = 65
  while (base64PubKey.length > 0) {
    pem += base64PubKey.substring(0, maxLineLength) + '\n'
    base64PubKey = base64PubKey.substring(maxLineLength)
  }
  pem += '-----END PUBLIC KEY-----\n'
  return pem
}

function readX509PublicKey (key) {
  const reader = new Ber.Reader(Buffer.from(key, 'base64'))
  reader.readSequence()
  reader.readSequence()
  reader.readOID() // Hey, I'm an elliptic curve
  reader.readOID() // This contains the curve type, could be useful
  return Buffer.from(reader.readString(Ber.BitString, true)).slice(1)
}

function testMC () {
  // const pubKeyBuf = Buffer.from(constants.PUBLIC_KEY, 'base64')
  // const pem = mcPubKeyToPem(pubKeyBuf)
  // console.log(mcPubKeyToPem(pubKeyBuf))
  // const publicKey = crypto.createPublicKey({ key: pem, format: 'der' })

  const pubKeyBuf = readX509PublicKey(constants.PUBLIC_KEY)

  // console.log('Mojang pub key', pubKeyBuf.toString('hex'), publicKey)
  startClientboundEncryption(pubKeyBuf)
}

function testMC2 () {
  // const mojangPubKeyBuf = Buffer.from('MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE8ELkixyLcwlZryUQcu1TvPOmI2B7vX83ndnWRUaXm74wFfa5f/lwQNTfrLVHa2PmenpGI6JhIMUJaWZrjmMj90NoKNFSNBuKdm8rYiXsfaz3K36x/1U26HpG0ZxK/V1V', 'base64')
  // const pem = mcPubKeyToPem(mojangPubKeyBuf)
  // const publicKey = crypto.createPublicKey({ key: pem })

  const publicKey = readX509PublicKey(constants.PUBLIC_KEY)

  const curve = 'secp384r1'
  const alice = crypto.createECDH(curve)
  // const keys = crypto.generateKeyPair('ec',)

  // const bob = crypto.generateKeyPairSync('ec', {
  //     namedCurve: type
  // })
  // alice.setPrivateKey(bob.privateKey.export({ type: 'pkcs8', format: 'pem' }))
  // alice.setPublicKey(bob.publicKey.export({ type: 'spki', format: 'pem' }))

  // console.log(bob)

  const aliceKey = alice.generateKeys()

  const alicePEM = ec_pem(alice, curve)

  const alicePEMPrivate = alicePEM.encodePrivateKey()
  const alicePEMPublic = alicePEM.encodePublicKey()

  // const alicePublicKey = aliceKey.toString('base64')
  // const alicePrivateKey = alice.getPrivateKey().toString('base64')
  const aliceSecret = alice.computeSecret(publicKey, null, 'hex')

  console.log('Alice private key PEM', alicePEMPrivate)
  console.log('Alice public key PEM', alicePEMPublic)
  console.log('Alice public key', alice.getPublicKey('base64'))
  console.log('Alice secret key', aliceSecret)

  const sign = crypto.createSign('RSA-SHA256')
  sign.write('something')
  sign.end()
  // //     const pem2 =
  // //         `-----BEGIN PRIVATE KEY-----
  // // ${alice.getPrivateKey('base64')}
  // // -----END PRIVATE KEY-----`

  //     console.log('PEM', bob.privateKey)
  const sig = sign.sign(alicePEMPrivate, 'hex')
  console.log('Signature', sig)

  const token = JWT.sign({
    salt: 'HELLO',
    signedToken: alice.getPublicKey('base64')
  }, alicePEMPrivate, { algorithm: 'ES384' })
  console.log('Token', token)

  const verified = JWT.verify(token, alicePEMPublic, { algorithms: 'ES384' })
  console.log('Verified!', verified)
}

function testMC3 () {
  const Ber = require('asn1').Ber
  const reader = new Ber.Reader(new Buffer(constants.PUBLIC_KEY, 'base64'))
  reader.readSequence()
  reader.readSequence()
  reader.readOID() // Hey, I'm an elliptic curve
  reader.readOID() // This contains the curve type, could be useful
  const pubKey = reader.readString(Ber.BitString, true).slice(1)
  const server = crypto.createECDH('secp384r1')
  server.generateKeys()
  console.log(server.computeSecret(pubKey))
}

// testECDH2()
testMC2()
