const crypto = require('crypto')

const appIdBuffer = Buffer.allocUnsafe(8)
appIdBuffer.writeBigUInt64LE(BigInt(0xdeadbeef))

const AES_KEY = crypto.createHash('sha256')
  .update(appIdBuffer)
  .digest()

function encrypt (data) {
  const cipher = crypto.createCipheriv('aes-256-ecb', AES_KEY, null)
  return Buffer.concat([cipher.update(data), cipher.final()])
}

function decrypt (data) {
  const decipher = crypto.createDecipheriv('aes-256-ecb', AES_KEY, null)
  return Buffer.concat([decipher.update(data), decipher.final()])
}

function calculateChecksum (data) {
  const hmac = crypto.createHmac('sha256', AES_KEY)
  hmac.update(data)
  return hmac.digest()
}

module.exports = {
  encrypt,
  decrypt,
  calculateChecksum
}
