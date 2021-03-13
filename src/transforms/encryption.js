const { Transform } = require('readable-stream')
const crypto = require('crypto')
const aesjs = require('aes-js')
const Zlib = require('zlib')

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
    this.aes = new aesjs.ModeOfOperation.cfb(secret, iv, 1) // eslint-disable-line new-cap
  }

  _transform (chunk, enc, cb) {
    try {
      const res = this.aes.encrypt(chunk)
      cb(null, res)
    } catch (e) {
      cb(e)
    }
  }
}

class Decipher extends Transform {
  constructor (secret, iv) {
    super()
    this.aes = new aesjs.ModeOfOperation.cfb(secret, iv, 1) // eslint-disable-line new-cap
  }

  _transform (chunk, enc, cb) {
    try {
      const res = this.aes.decrypt(chunk)
      cb(null, res)
    } catch (e) {
      cb(e)
    }
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
    const buffer = Zlib.deflateRawSync(chunk, { level: 7 })
    const packet = Buffer.concat([buffer, computeCheckSum(buffer, client.sendCounter, client.secretKeyBytes)])
    client.sendCounter++
    client.cipher.write(packet)
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
    // TODO: remove the extra logic here, probably fixed with new raknet impl

    // console.log('Decryptor: checking checksum', client.receiveCounter, chunk)
    // client.outLog('🔵 Inflating', chunk)
    // First try to zlib decompress, then see how much bytes get read
    const { buffer, engine } = Zlib.inflateRawSync(chunk, {
      chunkSize: 1024 * 1024 * 2,
      info: true
    })

    // Holds how much bytes we read, also where the checksum (should) start
    const inflatedLen = engine.bytesRead
    // It appears that mc sends extra bytes past the checksum. I don't think this is a raknet
    // issue (as we are able to decipher properly, zlib works and should also have a checksum) so
    // there needs to be more investigation done. If you know what's wrong here, please make an issue :)
    const extraneousLen = chunk.length - inflatedLen - 8
    if (extraneousLen > 0) { // Extra bytes
      // Info for debugging, todo: use debug()
      const extraneousBytes = chunk.slice(inflatedLen + 8)
      console.debug('Extraneous bytes!', extraneousLen, extraneousBytes.toString('hex'))
    } else if (extraneousLen < 0) {
      // No checksum or decompression failed
      console.warn('Failed to decrypt', chunk.toString('hex'))
      throw new Error('Decrypted packet is missing checksum')
    }

    const packet = chunk.slice(0, inflatedLen)
    const checksum = chunk.slice(inflatedLen, inflatedLen + 8)
    const computedCheckSum = computeCheckSum(packet, client.receiveCounter, client.secretKeyBytes)
    client.receiveCounter++

    if (checksum.toString('hex') === computedCheckSum.toString('hex')) {
      client.onDecryptedPacket(buffer)
    } else {
      console.log('Inflated', inflatedLen, chunk.length, extraneousLen, chunk.toString('hex'))
      throw Error(`Checksum mismatch ${checksum.toString('hex')} != ${computedCheckSum.toString('hex')}`)
    }
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
