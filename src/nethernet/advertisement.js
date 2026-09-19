const { Versions, CURRENT_VERSION } = require('../options')
const { ProtoDef, types } = require('protodef')
const schemas = require('./advertisement.json')

const proto = new ProtoDef(false)
// Delegate the encoding to ProtoDef; enforce the 32-bit widths of this wire format.
for (const name of ['varint', 'zigzag32']) {
  const [read, write, sizeOf] = types[name]
  proto.addType(name, [function (buffer, offset) {
    const result = read.call(this, buffer, offset)
    if (result.size > 5 || (result.size === 5 && (buffer[offset + 4] & 0xf0))) throw new Error('Advertisement varint exceeds 32 bits')
    if (name === 'varint' && result.value < 0) throw new Error('Invalid advertisement string length')
    return result
  }, write, sizeOf])
}
proto.addTypes(schemas)

function typeFor (version) {
  if (version !== 4 && version !== 7) throw new Error(`Unsupported Nethernet advertisement version: ${version}`)
  return `advertisement_v${version}`
}

class NethernetServerAdvertisement {
  version = 7
  motd = 'Bedrock Protocol Server'
  protocol = Versions[CURRENT_VERSION]
  gameVersion = CURRENT_VERSION
  levelName = 'bedrock-protocol'
  gamemodeId = 0
  playerCount = 0
  playersMax = 8
  isEditorWorld = false
  hardcore = false
  acceptsOnlineAuth = true
  acceptsSelfSignedAuth = true
  nonce = ''
  connectionType = 4
  // version 4 trailer
  unknown1 = 4
  unknown2 = 8

  constructor (obj, gameVersion) {
    if (typeof obj === 'string') obj = { motd: obj }
    if (gameVersion && Versions[gameVersion]) { this.gameVersion = gameVersion; this.protocol = Versions[gameVersion] }
    Object.assign(this, obj)
  }

  get playersOnline () { return this.playerCount }
  set playersOnline (n) { this.playerCount = n }

  static fromBuffer (buffer) {
    const version = buffer.readUInt8(0)
    const type = typeFor(version)
    const { value, size } = proto.read(buffer, 0, type)
    // Older v4 senders can omit any suffix of these four one-byte fields.
    if (version === 4) {
      const fields = ['isEditorWorld', 'hardcore', 'unknown1', 'unknown2']
      if (buffer.length - size > fields.length) throw new Error('Trailing advertisement data')
      for (let i = 0; i < buffer.length - size; i++) {
        value[fields[i]] = proto.read(buffer, size + i, i < 2 ? 'bool' : 'u8').value
      }
    } else if (size !== buffer.length) {
      throw new Error('Trailing advertisement data')
    }
    return new NethernetServerAdvertisement(value)
  }

  toBuffer () {
    const type = typeFor(this.version)
    for (const field of ['motd', 'levelName', ...(this.version === 7 ? ['gameVersion', 'nonce'] : [])]) {
      if (typeof this[field] !== 'string') throw new TypeError(`${field} must be a string`)
      if (this.version === 4 && Buffer.byteLength(this[field], 'utf8') > 255) throw new RangeError(`${field} exceeds the version 4 byte limit`)
    }
    const fields = this.version === 7
      ? ['protocol', 'playerCount', 'playersMax', 'gamemodeId', 'connectionType']
      : ['playerCount', 'playersMax']
    for (const field of fields) {
      if (!Number.isInteger(this[field]) || this[field] < -2147483648 || this[field] > 2147483647) throw new RangeError(`${field} must be a signed 32-bit integer`)
    }
    const body = proto.createPacketBuffer(type, this)
    return this.version === 4 ? Buffer.concat([body, proto.createPacketBuffer('advertisement_v4_trailer', this)]) : body
  }
}

module.exports = { NethernetServerAdvertisement }
