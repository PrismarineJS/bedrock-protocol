const Framer = require('./transforms/framer')
const cipher = require('./transforms/encryption')
const { EventEmitter } = require('events')
const { Versions, MIN_VERSION } = require('./options')
const debug = require('debug')('minecraft-protocol')

const ClientStatus = {
  Disconnected: 0,
  Authenticating: 1, // Handshaking
  Initializing: 2, // Authed, need to spawn
  Initialized: 3 // play_status spawn sent by server, client responded with SetPlayerInit packet
}

class Connection extends EventEmitter {
  #status = ClientStatus.Disconnected
  sendQ = []
  sendIds = []

  get status () {
    return this.#status
  }

  set status (val) {
    debug('* new status', val)
    this.emit('status', val)
    this.#status = val
  }

  validateOptions () {
    if (!Versions[this.options.version]) {
      console.warn('Supported versions', Versions)
      throw Error(`Unsupported version ${this.options.version}`)
    }

    this.options.protocolVersion = Versions[this.options.version]
    if (this.options.protocolVersion < MIN_VERSION) {
      throw new Error(`Protocol version < ${MIN_VERSION} : ${this.options.protocolVersion}, too old`)
    }
    this.compressionLevel = this.options.compressionLevel || 7
    if (this.options.useNativeRaknet === true) this.options.raknetBackend = 'raknet-native'
    if (this.options.useNativeRaknet === false) this.options.raknetBackend = 'jsp-raknet'
  }

  versionLessThan (version) {
    return this.options.protocolVersion < (typeof version === 'string' ? Versions[version] : version)
  }

  versionGreaterThan (version) {
    return this.options.protocolVersion > (typeof version === 'string' ? Versions[version] : version)
  }

  startEncryption (iv) {
    this.encryptionEnabled = true
    this.inLog?.('Started encryption', this.sharedSecret, iv)
    this.decrypt = cipher.createDecryptor(this, iv)
    this.encrypt = cipher.createEncryptor(this, iv)
  }

  updateItemPalette (palette) {
    // In the future, we can send down the whole item palette if we need
    // but since it's only one item, we can just make a single variable.
    let shieldItemID
    for (const state of palette) {
      if (state.name === 'minecraft:shield') {
        shieldItemID = state.runtime_id
        break
      }
    }
    if (shieldItemID) {
      this.serializer.proto.setVariable('ShieldItemID', shieldItemID)
      this.deserializer.proto.setVariable('ShieldItemID', shieldItemID)
    }
  }

  write (name, params) {
    this.outLog?.(name, params)
    if (name === 'start_game') this.updateItemPalette(params.itemstates)
    const batch = new Framer(this.compressionLevel)
    const packet = this.serializer.createPacketBuffer({ name, params })
    batch.addEncodedPacket(packet)

    if (this.encryptionEnabled) {
      this.sendEncryptedBatch(batch)
    } else {
      this.sendDecryptedBatch(batch)
    }
  }

  queue (name, params) {
    this.outLog?.('Q <- ', name, params)
    if (name === 'start_game') this.updateItemPalette(params.itemstates)
    const packet = this.serializer.createPacketBuffer({ name, params })
    if (name === 'level_chunk') {
      // Skip queue, send ASAP
      this.sendBuffer(packet)
      return
    }
    this.sendQ.push(packet)
    this.sendIds.push(name)
  }

  _tick () {
    if (this.sendQ.length) {
      const batch = new Framer(this.compressionLevel)
      batch.addEncodedPackets(this.sendQ)
      this.sendQ = []
      this.sendIds = []
      if (this.encryptionEnabled) {
        this.sendEncryptedBatch(batch)
      } else {
        this.sendDecryptedBatch(batch)
      }
    }
  }

  onTick = this._tick.bind(this)

  startQueue () {
    this.sendQ = []
    this.loop = setInterval(this.onTick, this.options.batchingInterval || 20)
  }

  /**
   * Sends a MCPE packet buffer
   */
  sendBuffer (buffer, immediate = false) {
    if (immediate) {
      const batch = new Framer(this.compressionLevel)
      batch.addEncodedPacket(buffer)
      if (this.encryptionEnabled) {
        this.sendEncryptedBatch(batch)
      } else {
        this.sendDecryptedBatch(batch)
      }
    } else {
      this.sendQ.push(buffer)
      this.sendIds.push('rawBuffer')
    }
  }

  sendDecryptedBatch (batch) {
    // send to raknet
    this.sendMCPE(batch.encode(), true)
  }

  sendEncryptedBatch (batch) {
    const buf = batch.getBuffer()
    this.encrypt(buf)
  }

  sendMCPE (buffer, immediate) {
    if (this.connection.connected === false || this.status === ClientStatus.Disconnected) return
    try {
      this.connection.sendReliable(buffer, immediate)
    } catch (e) {
      debug('while sending to', this.connection, e)
    }
  }

  // These are callbacks called from encryption.js
  onEncryptedPacket = (buf) => {
    const packet = Buffer.concat([Buffer.from([0xfe]), buf]) // add header

    this.sendMCPE(packet)
  }

  onDecryptedPacket = (buf) => {
    const packets = Framer.getPackets(buf)

    for (const packet of packets) {
      this.readPacket(packet)
    }
  }

  handle (buffer) { // handle encapsulated
    if (buffer[0] === 0xfe) { // wrapper
      if (this.encryptionEnabled) {
        this.decrypt(buffer.slice(1))
      } else {
        const packets = Framer.decode(buffer)
        for (const packet of packets) {
          this.readPacket(packet)
        }
      }
    }
  }
}

module.exports = { ClientStatus, Connection }
