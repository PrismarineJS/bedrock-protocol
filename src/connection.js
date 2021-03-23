const BinaryStream = require('@jsprismarine/jsbinaryutils').default
const BatchPacket = require('./datatypes/BatchPacket')
const cipher = require('./transforms/encryption')
const { EventEmitter } = require('events')
const Versions = require('./options')
const debug = require('debug')('minecraft-protocol')

const SKIP_BATCH = ['level_chunk', 'client_cache_blob_status', 'client_cache_miss_response']

const ClientStatus = {
  Disconnected: 0,
  Authenticating: 1, // Handshaking
  Initializing: 2, // Authed, need to spawn
  Initialized: 3 // play_status spawn sent by server, client responded with SetPlayerInit packet
}

class Connection extends EventEmitter {
  status = ClientStatus.Disconnected

  versionLessThan (version) {
    if (typeof version === 'string') {
      return Versions[version] < this.options.protocolVersion
    } else {
      return version < this.options.protocolVersion
    }
  }

  versionGreaterThan (version) {
    if (typeof version === 'string') {
      return Versions[version] > this.options.protocolVersion
    } else {
      return version > this.options.protocolVersion
    }
  }

  startEncryption (iv) {
    this.encryptionEnabled = true
    this.inLog('Started encryption', this.sharedSecret, iv)
    this.decrypt = cipher.createDecryptor(this, iv)
    this.encrypt = cipher.createEncryptor(this, iv)
    this.q2 = []
  }

  write (name, params) {
    this.outLog('sending', name, params)
    const batch = new BatchPacket()
    const packet = this.serializer.createPacketBuffer({ name, params })
    batch.addEncodedPacket(packet)

    if (this.encryptionEnabled) {
      this.sendEncryptedBatch(batch)
    } else {
      this.sendDecryptedBatch(batch)
    }
  }

  queue (name, params) {
    this.outLog('Q <- ', name, params)
    const packet = this.serializer.createPacketBuffer({ name, params })
    if (SKIP_BATCH.includes(name)) {
      // Skip queue, send ASAP
      this.sendBuffer(packet)
      return
    }
    this.q.push(packet)
    this.q2.push(name)
  }

  startQueue () {
    this.q = []
    this.loop = setInterval(() => {
      if (this.q.length) {
        // TODO: can we just build Batch before the queue loop?
        const batch = new BatchPacket()
        this.outLog('<- BATCH', this.q2)
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
      }
    }, 20)
  }

  /**
   * Sends a MCPE packet buffer
   */
  sendBuffer (buffer, immediate = false) {
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

  sendDecryptedBatch (batch) {
    const buf = batch.encode()
    // send to raknet
    this.sendMCPE(buf, true)
  }

  sendEncryptedBatch (batch) {
    const buf = batch.stream.getBuffer()
    debug('Sending encrypted batch', batch)
    this.encrypt(buf)
  }

  // TODO: Rename this to sendEncapsulated
  sendMCPE (buffer, immediate) {
    if (this.connection.connected === false) return
    this.connection.sendReliable(buffer, immediate)
  }

  // These are callbacks called from encryption.js
  onEncryptedPacket = (buf) => {
    this.outLog('Enc buf', buf)
    const packet = Buffer.concat([Buffer.from([0xfe]), buf]) // add header

    this.outLog('Sending wrapped encrypted batch', packet)
    this.sendMCPE(packet)
  }

  onDecryptedPacket = (buf) => {
    const stream = new BinaryStream(buf)
    const packets = BatchPacket.getPackets(stream)

    for (const packet of packets) {
      this.readPacket(packet)
    }
  }

  handle (buffer) { // handle encapsulated
    if (buffer[0] === 0xfe) { // wrapper
      if (this.encryptionEnabled) {
        this.decrypt(buffer.slice(1))
      } else {
        const stream = new BinaryStream(buffer)
        const batch = new BatchPacket(stream)
        batch.decode()
        const packets = batch.getPackets()
        this.inLog('Reading ', packets.length, 'packets')
        for (const packet of packets) {
          this.readPacket(packet)
        }
      }
    }
  }
}

module.exports = { ClientStatus, Connection }
