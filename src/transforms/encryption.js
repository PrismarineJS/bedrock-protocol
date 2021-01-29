const Transform = require('readable-stream').Transform
const crypto = require('crypto')
const aesjs = require('aes-js')
const Zlib = require('zlib')

const CIPHER = 'aes-256-cfb8'

function createCipher(secret, initialValue) {
  if (crypto.getCiphers().includes(CIPHER)) {
    return crypto.createCipheriv(CIPHER, secret, initialValue)
  }
  return new Cipher(secret, initialValue)
}

function createDecipher(secret, initialValue) {
  if (crypto.getCiphers().includes(CIPHER)) {
    return crypto.createDecipheriv(CIPHER, secret, initialValue)
  }
  return new Decipher(secret, initialValue)
}

class Cipher extends Transform {
  constructor(secret, iv) {
    super()
    this.aes = new aesjs.ModeOfOperation.cfb(secret, iv, 1) // eslint-disable-line new-cap
  }

  _transform(chunk, enc, cb) {
    try {
      const res = this.aes.encrypt(chunk)
      cb(null, res)
    } catch (e) {
      cb(e)
    }
  }
}

class Decipher extends Transform {
  constructor(secret, iv) {
    super()
    this.aes = new aesjs.ModeOfOperation.cfb(secret, iv, 1) // eslint-disable-line new-cap
  }

  _transform(chunk, enc, cb) {
    try {
      const res = this.aes.decrypt(chunk)
      cb(null, res)
    } catch (e) {
      cb(e)
    }
  }
}

function computeCheckSum(packetPlaintext, sendCounter, secretKeyBytes) {
  let digest = crypto.createHash('sha256');
  let counter = Buffer.alloc(8)
  // writeLI64(sendCounter, counter, 0);
  counter.writeBigInt64LE(sendCounter, 0)
  console.log('Send counter' , counter)
  digest.update(counter);
  digest.update(packetPlaintext);
  digest.update(secretKeyBytes);
  let hash = digest.digest();

  return hash.slice(0, 8);
}

function createEncryptor(client, iv) {
  client.cipher = createCipher(client.secretKeyBytes, iv)

}

function createDecryptor(client, iv) {
  client.decipher = createDecipher(client.secretKeyBytes, iv)
  client.receiveCounter = client.receiveCounter || 0n

  const decryptor = new Transform({
    transform(chunk, encoding, cb) {
      console.log('Got transform', chunk)
      const packet = chunk.slice(0, chunk.length - 8);
      const checksum = chunk.slice(chunk.length - 8);
      const computedCheckSum = computeCheckSum(packet, client.receiveCounter, client.secretKeyBytes)
      // const computedCheckSum1 = computeCheckSum(packet, 1n, client.secretKeyBytes)
      // console.log('Checksums', checksum)
      // console.log('Checksum1', computedCheckSum)
      // console.log('Checksum2', computedCheckSum1)
      console.assert(checksum.toString("hex") == computedCheckSum.toString("hex"), 'checksum mismatch')
      client.receiveCounter++
      if (checksum.toString("hex") == computedCheckSum.toString("hex")) this.push(packet)
      else console.log('FAILED', checksum.toString("hex"), computedCheckSum.toString("hex"))
      // else process.exit(`Checksum mismatch ${checksum.toString("hex")} - ${computedCheckSum.toString("hex")}`) // TODO: remove
      cb()
    }
  })

  client.decipher.pipe(decryptor)
    .pipe(Zlib.createInflateRaw({ chunkSize: 1024 * 1024 * 2 }))
    .on('data', client.onDecryptedPacket)
    // .on('end', () => console.log('Finished!'))

  return (blob) => {
    client.decipher.write(blob)
  }
}

module.exports = {
  createCipher, createDecipher, createEncryptor, createDecryptor
}
