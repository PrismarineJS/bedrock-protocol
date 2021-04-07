const { Transform } = require('readable-stream')
const crypto = require('crypto')
const Zlib = require('zlib')
if (globalThis.isElectron) var { CipherCFB8 } = require('raknet-native') // eslint-ignore-line

const CIPHER_ALG = 'aes-256-cfb8'

function createCipher (secret, initialValue) {
  if (crypto.getCiphers().includes(CIPHER_ALG)) {
    return crypto.createCipheriv(CIPHER_ALG, secret, initialValue)
  }
  return new Cipher(secret, initialValue)
}

function createDecipher (secret, initialValue) {
  if (crypto.getCiphers().includes(CIPHER_ALG)) {
    return crypto.createDecipheriv(CIPHER_ALG, secret, initialValue)
  }
  return new Decipher(secret, initialValue)
}

class Cipher extends Transform {
  constructor (secret, iv) {
    super()
    this.aes = new CipherCFB8(secret, iv)
  }

  _transform (chunk, enc, cb) {
    const ciphered = this.aes.cipher(chunk)
    cb(null, ciphered)
  }
}

class Decipher extends Transform {
  constructor (secret, iv) {
    super()
    this.aes = new CipherCFB8(secret, iv)
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
  client.cipher = createCipher(client.secretKeyBytes, iv)
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
  client.decipher = createDecipher(client.secretKeyBytes, iv)
  client.receiveCounter = client.receiveCounter || 0n

  function verify (chunk) {
    // console.log('Decryptor: checking checksum', client.receiveCounter, chunk)
    const packet = chunk.slice(0, chunk.length - 8)
    const checksum = chunk.slice(chunk.length - 8, chunk.length)
    const computedCheckSum = computeCheckSum(packet, client.receiveCounter, client.secretKeyBytes)
    client.receiveCounter++

    if (Buffer.compare(checksum, computedCheckSum) !== 0) {
      // console.log('Inflated', inflatedLen, chunk.length, extraneousLen, chunk.toString('hex'))
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

// function testDecrypt () {
//   const client = {
//     secretKeyBytes: Buffer.from('ZOBpyzki/M8UZv5tiBih048eYOBVPkQE3r5Fl0gmUP4=', 'base64'),
//     onDecryptedPacket: (...data) => console.log('Decrypted', data)
//   }
//   const iv = Buffer.from('ZOBpyzki/M8UZv5tiBih0w==', 'base64')

//   const decrypt = createDecryptor(client, iv)
//   console.log('Dec', decrypt(Buffer.from('4B4FCA0C2A4114155D67F8092154AAA5EF', 'hex')))
//   console.log('Dec 2', decrypt(Buffer.from('DF53B9764DB48252FA1AE3AEE4', 'hex')))
// }

// testDecrypt()
