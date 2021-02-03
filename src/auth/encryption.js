const JWT = require('jsonwebtoken')
const crypto = require('crypto')
const { Ber } = require('asn1')
const ec_pem = require('ec-pem')

const SALT = '🧂'

function Encrypt(client, options) {
  function startClientboundEncryption(publicKey) {
    console.warn('[encrypt] Pub key base64: ', publicKey)
    const pubKeyBuf = readX509PublicKey(publicKey.key)

    const curve = 'secp384r1'
    const alice = crypto.createECDH(curve)
    alice.generateKeys()
    const alicePEM = ec_pem(alice, curve) // https://github.com/nodejs/node/issues/15116#issuecomment-384790125
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

    client.secretKeyBytes = secretHash.digest()

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

  client.on('server.client_handshake', startClientboundEncryption)
}

function toBase64(string) {
  return Buffer.from(string).toString('base64')
} 

function readX509PublicKey(key) {
  var reader = new Ber.Reader(Buffer.from(key, "base64"));
  reader.readSequence();
  reader.readSequence();
  reader.readOID(); // Hey, I'm an elliptic curve
  reader.readOID(); // This contains the curve type, could be useful
  return Buffer.from(reader.readString(Ber.BitString, true)).slice(1);
}

function writeX509PublicKey(key) {
  var writer = new Ber.Writer();
  writer.startSequence();
  writer.startSequence();
  writer.writeOID("1.2.840.10045.2.1");
  writer.writeOID("1.3.132.0.34");
  writer.endSequence();
  writer.writeBuffer(Buffer.concat([Buffer.from([0x00]), key]), Ber.BitString);
  writer.endSequence();
  return writer.buffer.toString("base64");
}

module.exports = {
  readX509PublicKey,
  writeX509PublicKey,
  Encrypt
}