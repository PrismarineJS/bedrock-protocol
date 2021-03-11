const BinaryStream = require('@jsprismarine/jsbinaryutils').default
const BatchPacket = require('./datatypes/BatchPacket')
const cipher = require('./transforms/encryption')
const { EventEmitter } = require('events')
const Reliability = require('jsp-raknet/protocol/reliability')

const debug = require('debug')('minecraft-protocol')

class Connection extends EventEmitter {
  startEncryption(iv) {
    this.encryptionEnabled = true
    this.inLog('Started encryption', this.sharedSecret, iv)
    this.decrypt = cipher.createDecryptor(this, iv)
    this.encrypt = cipher.createEncryptor(this, iv)
    this.q2 = []
  }

  write(name, params) { // TODO: Batch
    // console.log('Need to encode', name, params)
    var s = this.connect ? 'C' : 'S'
    if (this.downQ) s += 'P'
    this.outLog('NB <- ' + s, name,params)
    const batch = new BatchPacket()
    const packet = this.serializer.createPacketBuffer({ name, params })
    // console.log('Sending buf', packet.toString('hex').)
    batch.addEncodedPacket(packet)

    if (this.encryptionEnabled) {
      this.sendEncryptedBatch(batch)
    } else {
      this.sendDecryptedBatch(batch)
    }
  }

  queue(name, params) {
    this.outLog('Q <- ', name, params)
    const packet = this.serializer.createPacketBuffer({ name, params })
    if (name == 'level_chunk' || name=='client_cache_blob_status' || name == 'client_cache_miss_response') {
      // Skip queue, send ASAP
      this.sendBuffer(packet)
      return
    }
    this.q.push(packet)
    this.q2.push(name)
  }

  startQueue() {
    this.q = []
    this.loop = setInterval(() => {
      if (this.q.length) {
        //TODO: can we just build Batch before the queue loop?
        const batch = new BatchPacket()
        this.outLog('<- BATCH', this.q2)
        // For now, we're over conservative so send max 3 packets
        // per batch and hold the rest for the next tick
        const sending = []
        for (let i = 0; i < this.q.length; i++) {
          const packet = this.q.shift()
          sending.push(this.q2.shift())
          batch.addEncodedPacket(packet)
        }
        // this.outLog('~~ Sending', sending)
        if (this.encryptionEnabled) {
          this.sendEncryptedBatch(batch)
        } else {
          this.sendDecryptedBatch(batch)
        }
        // this.q2 = []
      }
    }, 20)
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
    }

    if (this.encryptionEnabled) {
      this.sendEncryptedBatch(batch)
    } else {
      this.sendDecryptedBatch(batch)
    }
  }

  /**
   * Sends a MCPE packet buffer
   */
  sendBuffer(buffer, immediate = false) {
    if (immediate) {
      const batch = new BatchPacket()
      batch.addEncodedPacket(buffer)
      if (this.encryptionEnabled) {
        this.sendEncryptedBatch(batch)
      } else {
        this.sendDecryptedBatch(batch)
      }
    } else {
      this.q.push(buffer)
      this.q2.push('rawBuffer')
    }
  }

  sendDecryptedBatch(batch) {
    const buf = batch.encode()
    // send to raknet
    this.sendMCPE(buf, true)
  }

  sendEncryptedBatch(batch) {
    const buf = batch.stream.getBuffer()
    debug('Sending encrypted batch', batch)
    this.encrypt(buf)
  }

  // TODO: Rename this to sendEncapsulated
  sendMCPE(buffer, immediate) {
    this.connection.sendReliable(buffer, immediate)
    // if (this.worker) {
    //   this.outLog('-> buf', buffer)
    //   this.worker.postMessage({ type: 'queueEncapsulated', packet: buffer, immediate })
    // } else {
    //   const sendPacket = new EncapsulatedPacket()
    //   sendPacket.reliability = Reliability.ReliableOrdered
    //   sendPacket.buffer = buffer
    //   this.connection.addEncapsulatedToQueue(sendPacket)
    //   if (immediate) this.connection.sendQueue()
    // }
  }

  // These are callbacks called from encryption.js
  onEncryptedPacket = (buf) => {
    this.outLog('ENC BUF', buf)
    const packet = Buffer.concat([Buffer.from([0xfe]), buf]) // add header

    this.outLog('Sending wrapped encrypted batch', packet)
    this.sendMCPE(packet)
  }

  onDecryptedPacket = (buf) => {
    // console.log('🟢 Decrypted', buf)

    const stream = new BinaryStream(buf)
    const packets = BatchPacket.getPackets(stream)

    for (const packet of packets) {
      this.readPacket(packet)
    }
  }

  handle(buffer) { // handle encapsulated
    if (buffer[0] == 0xfe) { // wrapper
      if (this.encryptionEnabled) {
        this.decrypt(buffer.slice(1))
      } else {
        const stream = new BinaryStream(buffer)
        const batch = new BatchPacket(stream)
        batch.decode()
        const packets = batch.getPackets()
        this.inLog('Reading ', packets.length, 'packets')
        for (var packet of packets) {
          this.readPacket(packet)
        }
      }
    }
    // console.log('[client] handled incoming ', buffer)
  }
}
function serialize(obj = {}, fmt) {
  return JSON.stringify(obj, (k, v) => typeof v == 'bigint' ? v.toString() : v, fmt)
}
module.exports = { Connection }