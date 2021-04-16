const { Transform } = require('readable-stream')
const crypto = require('crypto')
const Zlib = require('zlib')
if (globalThis.isElectron) var { CipherGCM, CipherCFB8 } = require('raknet-native') // eslint-disable-line

function createCipher (secret, initialValue, cipherAlgorithm) {
  if (crypto.getCiphers().includes(cipherAlgorithm)) {
    return crypto.createCipheriv(cipherAlgorithm, secret, initialValue)
  }
  return new Cipher(secret, initialValue)
}

function createDecipher (secret, initialValue, cipherAlgorithm) {
  if (crypto.getCiphers().includes(cipherAlgorithm)) {
    return crypto.createDecipheriv(cipherAlgorithm, secret, initialValue)
  }
  return new Decipher(secret, initialValue)
}

class Cipher extends Transform {
  constructor (gcm, secret, iv) {
    super()
    this.aes = gcm ? new CipherGCM(secret, iv) : new CipherCFB8(secret, iv)
  }

  _transform (chunk, enc, cb) {
    const ciphered = this.aes.cipher(chunk)
    cb(null, ciphered)
  }
}

class Decipher extends Transform {
  constructor (gcm, secret, iv) {
    super()
    this.aes = gcm ? new CipherGCM(secret, iv) : new CipherCFB8(secret, iv)
  }

  _transform (chunk, enc, cb) {
    cb(null, this.aes.decipher(chunk))
  }
}

function computeCheckSum (packetPlaintext, sendCounter, secretKeyBytes) {
  const digest = crypto.createHash('sha256')
  const counter = Buffer.alloc(8)
  counter.writeBigInt64LE(sendCounter, 0)
  digest.update(counter)
  digest.update(packetPlaintext)
  digest.update(secretKeyBytes)
  const hash = digest.digest()
  return hash.slice(0, 8)
}

function createEncryptor (client, iv) {
  if (client.versionLessThan('1.16.220')) {
    client.cipher = createCipher(client.secretKeyBytes, iv, 'aes-256-cfb8')
  } else {
    client.cipher = createCipher(client.secretKeyBytes, iv.slice(0, 12), 'aes-256-gcm')
  }
  client.sendCounter = client.sendCounter || 0n

  // A packet is encrypted via AES256(plaintext + SHA256(send_counter + plaintext + secret_key)[0:8]).
  // The send counter is represented as a little-endian 64-bit long and incremented after each packet.

  function process (chunk) {
    Zlib.deflateRaw(chunk, { level: 7 }, (err, buffer) => {
      if (err) throw err
      const packet = Buffer.concat([buffer, computeCheckSum(buffer, client.sendCounter, client.secretKeyBytes)])
      client.sendCounter++
      client.cipher.write(packet)
    })
  }

  client.cipher.on('data', client.onEncryptedPacket)

  return (blob) => {
    process(blob)
  }
}

function createDecryptor (client, iv) {
  if (client.versionLessThan('1.16.220')) {
    client.decipher = createDecipher(client.secretKeyBytes, iv, 'aes-256-cfb8')
  } else {
    client.decipher = createDecipher(client.secretKeyBytes, iv.slice(0, 12), 'aes-256-gcm')
  }

  client.receiveCounter = client.receiveCounter || 0n

  function verify (chunk) {
    const packet = chunk.slice(0, chunk.length - 8)
    const checksum = chunk.slice(chunk.length - 8, chunk.length)
    const computedCheckSum = computeCheckSum(packet, client.receiveCounter, client.secretKeyBytes)
    client.receiveCounter++

    if (Buffer.compare(checksum, computedCheckSum) !== 0) {
      throw Error(`Checksum mismatch ${checksum.toString('hex')} != ${computedCheckSum.toString('hex')}`)
    }

    Zlib.inflateRaw(chunk, { chunkSize: 1024 * 1024 * 2 }, (err, buffer) => {
      if (err) throw err
      client.onDecryptedPacket(buffer)
    })
  }

  client.decipher.on('data', verify)

  return (blob) => {
    client.decipher.write(blob)
  }
}

module.exports = {
  createCipher, createDecipher, createEncryptor, createDecryptor
}
