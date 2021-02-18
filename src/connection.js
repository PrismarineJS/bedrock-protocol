const BinaryStream = require('@jsprismarine/jsbinaryutils').default
const BatchPacket = require('./datatypes/BatchPacket')
const cipher = require('./transforms/encryption')
const { EventEmitter } = require('events')
const EncapsulatedPacket = require('@jsprismarine/raknet/protocol/encapsulated_packet')


class Connection extends EventEmitter {
  startEncryption(iv) {
    this.encryptionEnabled = true
    console.log('Started encryption', this.sharedSecret, iv)
    this.decrypt = cipher.createDecryptor(this, iv)
    this.encrypt = cipher.createEncryptor(this, iv)
  }

  write(name, params) { // TODO: Batch
    console.log('Need to encode', name, params)
    const batch = new BatchPacket()
    const packet = this.serializer.createPacketBuffer({ name, params })
    batch.addEncodedPacket(packet)

    if (this.encryptionEnabled) {
      this.sendEncryptedBatch(batch)
    } else {
      this.sendDecryptedBatch(batch)
    }
  }

  writeRaw(name, buffer) { // skip protodef serializaion
    // temporary hard coded stuff
    const batch = new BatchPacket()
    if (name == 'biome_definition_list') {
      // so we can send nbt straight from file without parsing
      const stream = new BinaryStream()
      stream.writeUnsignedVarInt(0x7a)
      stream.append(buffer)
      batch.addEncodedPacket(stream.getBuffer())
      // console.log('----- SENDING BIOME DEFINITIONS')
    }

    if (this.encryptionEnabled) {
      this.sendEncryptedBatch(batch)
    } else {
      this.sendDecryptedBatch(batch)
    }
  }

  sendDecryptedBatch(batch) {
    const buf = batch.encode()
    // send to raknet
    this.sendMCPE(buf, true)
  }

  sendEncryptedBatch(batch) {
    const buf = batch.stream.getBuffer()
    console.log('Sending encrypted batch', batch)
    this.encrypt(buf)
  }

  sendMCPE(buffer, immediate) {
    if (this.worker) {
      console.log('-> buf', buffer)
      this.worker.postMessage({ type: 'queueEncapsulated', packet: buffer, immediate })
    } else {
      const sendPacket = new EncapsulatedPacket();
      sendPacket.reliability = 0
      sendPacket.buffer = buffer
      this.connection.addEncapsulatedToQueue(sendPacket)
      if (immediate) this.connection.sendQueue()
    }
  }

  // These are callbacks called from encryption.js
  onEncryptedPacket = (buf) => {
    console.log('ENC BUF', buf)
    const packet = Buffer.concat([Buffer.from([0xfe]), buf]) // add header

    console.log('Sending wrapped encrypted batch', packet)
    this.sendMCPE(packet)
  }

  onDecryptedPacket = (buf) => {
    console.log('🟢 Decrypted', buf)

    const stream = new BinaryStream(buf)
    const packets = BatchPacket.getPackets(stream)

    for (const packet of packets) {
      this.readPacket(packet)
    }
  }

  handle(buffer) { // handle encapsulated
    if (buffer[0] == 0xfe) { // wrapper
      if (this.encryptionEnabled) {
        console.trace('Reading encrypted packet', buffer.toString('hex'))
        this.decrypt(buffer.slice(1))
      } else {
        const stream = new BinaryStream(buffer)
        const batch = new BatchPacket(stream)
        batch.decode()
        const packets = batch.getPackets()
        console.log('Reading ', packets.length, 'packets')
        for (var packet of packets) {
          this.readPacket(packet)
        }
      }
    }
    console.log('[client] handled incoming ', buffer)
  }
}

module.exports = { Connection }