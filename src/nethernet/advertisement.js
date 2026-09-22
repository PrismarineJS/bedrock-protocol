const { Versions, CURRENT_VERSION } = require('../options')
const { ProtoDef } = require('protodef')
const schemas = require('minecraft-data/minecraft-data/data/bedrock/common/nethernetAdvertisement.json')

const proto = new ProtoDef(false)
proto.addTypes(schemas)

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
    const type = `advertisement_v${version}`
    const { value, size } = proto.read(buffer, 0, type)
    // Preserve the previous decoder's tolerance for omitted v4 trailer fields.
    if (version === 4) {
      let offset = size
      for (const { name, type } of schemas.advertisement_v4_trailer[1]) {
        if (offset >= buffer.length) break
        const field = proto.read(buffer, offset, type)
        value[name] = field.value
        offset += field.size
      }
    }
    const advertisement = new NethernetServerAdvertisement(value)
    advertisement.raw = buffer.toString('hex')
    return advertisement
  }

  toBuffer () {
    const type = `advertisement_v${this.version}`
    const body = proto.createPacketBuffer(type, this)
    return this.version === 4 ? Buffer.concat([body, proto.createPacketBuffer('advertisement_v4_trailer', this)]) : body
  }
}

module.exports = { NethernetServerAdvertisement }
