const crypto = require('crypto')
const Zlib = require('zlib')

function createCipher(secret, initialValue, cipherAlgorithm) {
  if (crypto.getCiphers().includes(cipherAlgorithm)) return crypto.createCipheriv(cipherAlgorithm, secret, initialValue)
}

function createDecipher(secret, initialValue, cipherAlgorithm) {
  if (crypto.getCiphers().includes(cipherAlgorithm)) return crypto.createDecipheriv(cipherAlgorithm, secret, initialValue)
}

function computeCheckSum(packetPlaintext, sendCounter, secretKeyBytes) {
  const counterBuffer = Buffer.allocUnsafe(8)
  counterBuffer.writeBigInt64LE(sendCounter, 0)

  const hash = crypto.createHash('sha256').update(counterBuffer).update(packetPlaintext).update(secretKeyBytes).digest();

  return hash.slice(0, 8);
}

function createEncryptor(client, iv) {
  client.cipher = createCipher(client.secretKeyBytes, iv.slice(0, 12), 'aes-256-gcm')
  client.sendCounter = client.sendCounter || 0n
  
  function process(chunk) {
    const compressedData = Zlib.deflateRawSync(chunk, { level: client.compressionLevel })
    const buffer = Buffer.allocUnsafe(compressedData.length + 1)

    buffer[0] = 0
    compressedData.copy(buffer, 1)

    const checksum = computeCheckSum(buffer, client.sendCounter, client.secretKeyBytes)

    client.sendCounter++
    client.cipher.write(Buffer.concat([buffer, checksum]))
  }

  client.cipher.on('data', client.onEncryptedPacket)

  return (blob) => {
    process(blob)
  }
}

function createDecryptor(client, iv) {
  client.decipher = createDecipher(client.secretKeyBytes, iv.slice(0, 12), 'aes-256-gcm')
  client.receiveCounter = client.receiveCounter || 0n

  function verify(chunk) {
    const packet = chunk.slice(0, chunk.length - 8)
    const checksum = chunk.slice(chunk.length - 8, chunk.length)
    const computedCheckSum = computeCheckSum(packet, client.receiveCounter, client.secretKeyBytes)
    client.receiveCounter++

    if (!checksum.equals(computedCheckSum)) {
      client.emit('error', Error(`Checksum mismatch ${checksum.toString('hex')} != ${computedCheckSum.toString('hex')}`))
      client.disconnect('disconnectionScreen.badPacket')
      return
    }

    let buffer
    
    switch (packet[0]) {
      case 0:
        buffer = Zlib.inflateRawSync(packet.slice(1), { chunkSize: 512000 })
        break
      case 255:
        buffer = packet.slice(1)
        break
      default:
        buffer = Zlib.inflateRawSync(packet.slice(1), { chunkSize: 512000 })
    }

    client.onDecryptedPacket(buffer)
  }

  client.decipher.on('data', verify)

  return (blob) => {
    client.decipher.write(blob)
  }
}

module.exports = { createCipher, createDecipher, createEncryptor, createDecryptor }