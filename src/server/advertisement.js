const { Versions, CURRENT_VERSION } = require('../options')

// LAN discovery advertisement carried in NetherNet discovery responses.
// Layout version 4 is what clients and servers up to 1.26.4x send; version 7 arrived with 1.26.50 (protocol 2193)
// and matches discovery.ServerData in df-mc/go-nethernet: strings are varint-length prefixed, numbers are
// zigzag varints, and the server advertises its protocol, game version, accepted auth modes and a nonce.
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
    const advertisement = new NethernetServerAdvertisement()
    let offset = 0
    const u8 = () => buffer.readUInt8(offset++)
    const varint = () => { let result = 0; let shift = 0; for (;;) { const b = u8(); result |= (b & 0x7f) << shift; if (!(b & 0x80)) return result >>> 0; shift += 7 } }
    const zigzag = () => { const n = varint(); return (n >>> 1) ^ -(n & 1) }
    const string = (length) => { const s = buffer.toString('utf8', offset, offset + length); offset += length; return s }

    advertisement.version = u8()
    if (advertisement.version >= 7) {
      advertisement.motd = string(varint())
      advertisement.protocol = zigzag()
      advertisement.gameVersion = string(varint())
      advertisement.levelName = string(varint())
      advertisement.playerCount = zigzag()
      advertisement.playersMax = zigzag()
      advertisement.gamemodeId = zigzag()
      advertisement.isEditorWorld = u8() === 1
      advertisement.hardcore = u8() === 1
      advertisement.acceptsOnlineAuth = u8() === 1
      advertisement.acceptsSelfSignedAuth = u8() === 1
      advertisement.nonce = string(varint())
      advertisement.connectionType = zigzag()
      return advertisement
    }
    advertisement.motd = string(u8())
    advertisement.levelName = string(u8())
    advertisement.gamemodeId = u8()
    advertisement.playerCount = buffer.readInt32LE(offset); offset += 4
    advertisement.playersMax = buffer.readInt32LE(offset); offset += 4
    if (offset < buffer.length) advertisement.isEditorWorld = u8() === 1
    if (offset < buffer.length) advertisement.hardcore = u8() === 1
    if (offset < buffer.length) advertisement.unknown1 = u8()
    if (offset < buffer.length) advertisement.unknown2 = u8()
    return advertisement
  }

  toBuffer () {
    const parts = []
    const u8 = (n) => parts.push(Buffer.from([n & 0xff]))
    const varint = (n) => { n >>>= 0; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; parts.push(Buffer.from([b])) } while (n) }
    const zigzag = (n) => varint((n << 1) ^ (n >> 31))
    const string = (s) => { const b = Buffer.from(s, 'utf8'); varint(b.length); parts.push(b) }

    u8(this.version)
    if (this.version >= 7) {
      string(this.motd)
      zigzag(this.protocol)
      string(this.gameVersion)
      string(this.levelName)
      zigzag(this.playerCount)
      zigzag(this.playersMax)
      zigzag(this.gamemodeId)
      u8(this.isEditorWorld ? 1 : 0)
      u8(this.hardcore ? 1 : 0)
      u8(this.acceptsOnlineAuth ? 1 : 0)
      u8(this.acceptsSelfSignedAuth ? 1 : 0)
      string(this.nonce)
      zigzag(this.connectionType)
      return Buffer.concat(parts)
    }
    const motd = Buffer.from(this.motd, 'utf8'); u8(motd.length); parts.push(motd)
    const level = Buffer.from(this.levelName, 'utf8'); u8(level.length); parts.push(level)
    u8(this.gamemodeId)
    const counts = Buffer.alloc(8); counts.writeInt32LE(this.playerCount, 0); counts.writeInt32LE(this.playersMax, 4); parts.push(counts)
    u8(this.isEditorWorld ? 1 : 0)
    u8(this.hardcore ? 1 : 0)
    u8(this.unknown1)
    u8(this.unknown2)
    return Buffer.concat(parts)
  }
}

class ServerAdvertisement {
  motd = 'Bedrock Protocol Server'
  levelName = 'bedrock-protocol'
  playersOnline = 0
  playersMax = 5
  gamemode = 'Creative'
  serverId = Date.now().toString()
  gamemodeId = 1
  portV4 = undefined
  portV6 = undefined

  constructor (obj, port, version = CURRENT_VERSION) {
    if (obj?.name) obj.motd = obj.name
    this.protocol = Versions[version]
    this.version = version
    this.portV4 = port
    this.portV6 = port
    Object.assign(this, obj)
  }

  fromString (str) {
    const [header, motd, protocol, version, playersOnline, playersMax, serverId, levelName, gamemode, gamemodeId, portV4, portV6] = str.split(';')
    Object.assign(this, { header, motd, protocol, version, playersOnline, playersMax, serverId, levelName, gamemode, gamemodeId, portV4, portV6 })
    for (const numeric of ['playersOnline', 'playersMax', 'gamemodeId', 'portV4', 'portV6']) {
      if (this[numeric] !== undefined) {
        this[numeric] = this[numeric] ? parseInt(this[numeric]) : null
      }
    }
    return this
  }

  toString () {
    return [
      'MCPE',
      this.motd,
      this.protocol,
      this.version,
      this.playersOnline,
      this.playersMax,
      this.serverId,
      this.levelName,
      this.gamemode,
      this.gamemodeId,
      this.portV4,
      this.portV6,
      '0'
    ].join(';') + ';'
  }

  toBuffer (version) {
    const str = this.toString(version)
    const length = Buffer.byteLength(str)
    const buf = Buffer.alloc(2 + length)
    buf.writeUInt16BE(length, 0)
    buf.write(str, 2)
    return buf
  }
}

module.exports = {
  ServerAdvertisement,
  NethernetServerAdvertisement,
  getServerName (client) {
    return new ServerAdvertisement().toBuffer()
  },
  fromServerName (string) {
    return new ServerAdvertisement().fromString(string)
  }
}
