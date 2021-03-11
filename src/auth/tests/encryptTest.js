const crypto = require('crypto')
const JWT = require('jsonwebtoken')
const constants = require('./constants')
const { Ber } = require('asn1')
const ec_pem = require('ec-pem')

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

function test (pubKey = constants.PUBLIC_KEY) {
  const publicKey = readX509PublicKey(pubKey)
  const curve = 'secp384r1'
  const alice = crypto.createECDH(curve)
  const aliceKey = alice.generateKeys()
  const alicePEM = ec_pem(alice, curve)
  const alicePEMPrivate = alicePEM.encodePrivateKey()
  const alicePEMPublic = alicePEM.encodePublicKey()
  const aliceSecret = alice.computeSecret(publicKey, null, 'hex')
  console.log('Alice private key PEM', alicePEMPrivate)
  console.log('Alice public key PEM', alicePEMPublic)
  console.log('Alice public key', alice.getPublicKey('hex'))
  console.log('Alice secret key', aliceSecret)

  // Test signing manually
  const sign = crypto.createSign('RSA-SHA256')
  sign.write('🧂')
  sign.end()
  const sig = sign.sign(alicePEMPrivate, 'hex')
  console.log('Signature', sig)

  // Test JWT sign+verify
  const x509 = writeX509PublicKey(alice.getPublicKey())
  const token = JWT.sign({
    salt: 'HELLO',
    signedToken: alice.getPublicKey('base64')
  }, alicePEMPrivate, { algorithm: 'ES384', header: { x5u: x509 } })
  console.log('Encoded JWT', token)
  // send the jwt to the client...

  const verified = JWT.verify(token, alicePEMPublic, { algorithms: 'ES384' })
  console.log('Decoded JWT', verified)
  // Good
}

/**
 * Alice private key PEM -----BEGIN EC PRIVATE KEY-----
MIGkAgEBBDBGgHZwH3BzieyJrdrVTVLmrEoUxpDUSqSzS98lobTXeUxJR/OmywPV
57I8YtnsJlCgBwYFK4EEACKhZANiAATjvTRgjsxKruO7XbduSQoHeR/6ouIm4Rmc
La9EkSpLFpuYZfsdtq9Vcf2t3Q3+jIbXjD/wNo97P4Hr5ghXG8sCVV7jpqadOF8j
SzyfajLGfX9mkS5WWLAg+dpi/KiEo/g=
-----END EC PRIVATE KEY-----

Alice public key PEM -----BEGIN PUBLIC KEY-----
MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE4700YI7MSq7ju123bkkKB3kf+qLiJuEZ
nC2vRJEqSxabmGX7HbavVXH9rd0N/oyG14w/8DaPez+B6+YIVxvLAlVe46amnThf
I0s8n2oyxn1/ZpEuVliwIPnaYvyohKP4
-----END PUBLIC KEY-----

Alice public key 04e3bd34608ecc4aaee3bb5db76e490a07791ffaa2e226e1199c2daf44912a4b169b9865fb1db6af5571fdaddd0dfe8c86d78c3ff0368f7b3f81ebe608571bcb02555ee3a6a69d385f234b3c9f6a32c67d7f66912e5658b020f9da62fca884a3f8
Alice secret key 76feb5d420b33907c4841a74baa707b717a29c021b17b6662fd46dba3227cac3e256eee9e890edb0308f66a3119b4914
Signature 3066023100d5ea70b8fc5e441c5e93d9f7dcde031f54291011c950a4aa8625ea9b27f7c798a8bc4de40baf35d487a05db6b5c628c6023100ae06cc2ea65db77138163c546ccf13933faae3d91bd6aa7108b99539cdb1c86f1e8a3704cb099f0b00eebed4ee75ccb2
Encoded JWT eyJhbGciOiJFUzM4NCIsInR5cCI6IkpXVCJ9.eyJzYWx0IjoiSEVMTE8iLCJzaWduZWRUb2tlbiI6IkJPTzlOR0NPekVxdTQ3dGR0MjVKQ2dkNUgvcWk0aWJoR1p3dHIwU1JLa3NXbTVobCt4MjJyMVZ4L2EzZERmNk1odGVNUC9BMmozcy9nZXZtQ0ZjYnl3SlZYdU9tcHAwNFh5TkxQSjlxTXNaOWYyYVJMbFpZc0NENTJtTDhxSVNqK0E9PSIsImlhdCI6MTYxMTc4MDYwNX0._g8k086U7nD-Tthn8jGWuuM3Q4EfhgqCfFA1Q5ePmjqhqMHOJvmrCz6tWsCytr2i-a2M51fb9K_YDAHbZ66Kos9ZkjF4Tqz5fPS880fM9woZ_1xjh7nGcOQ6sbY81zyi
Decoded JWT {
  salt: 'HELLO',
  signedToken: 'BOO9NGCOzEqu47tdt25JCgd5H/qi4ibhGZwtr0SRKksWm5hl+x22r1Vx/a3dDf6MhteMP/A2j3s/gevmCFcbywJVXuOmpp04XyNLPJ9qMsZ9f2aRLlZYsCD52mL8qISj+A==',
  iat: 1611780605
}
 */

test()
