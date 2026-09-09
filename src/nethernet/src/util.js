const { encrypt, calculateChecksum, decrypt } = require('./crypto')

const getRandomUint64 = () => {
  const high = Math.floor(Math.random() * 0xFFFFFFFF)
  const low = Math.floor(Math.random() * 0xFFFFFFFF)

  return (BigInt(high) << 32n) | BigInt(low)
}

const createPacketData = (packetName, packetId, senderId, additionalParams = {}) => {
  return {
    name: packetName,
    params: {
      sender_id: senderId,
      reserved: Buffer.allocUnsafe(8),
      ...additionalParams
    }
  }
}

const prepareSecurePacket = (serializer, packetData) => {
  const buf = serializer.createPacketBuffer(packetData)

  const checksum = calculateChecksum(buf)
  const encryptedData = encrypt(buf)

  return Buffer.concat([checksum, encryptedData])
}

const processSecurePacket = (buffer, deserializer) => {
  if (buffer.length < 32) throw new Error('Packet is too short')

  const decryptedData = decrypt(buffer.slice(32))
  const checksum = calculateChecksum(decryptedData)

  if (Buffer.compare(buffer.slice(0, 32), checksum) !== 0) throw new Error('Checksum mismatch')

  const packet = deserializer.parsePacketBuffer(decryptedData)

  return { name: packet.data.name, params: packet.data.params }
}

module.exports = { getRandomUint64, createPacketData, prepareSecurePacket, processSecurePacket }