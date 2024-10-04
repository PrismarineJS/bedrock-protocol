const { Versions, CURRENT_VERSION } = require('../options')

const { ServerData } = require('../nethernet/discovery/ServerData')

class NethernetServerAdvertisement {
  version = 3
  motd = 'Bedrock Protocol Server'
  levelName = 'bedrock-protocol'
  gamemodeId = 2
  playerCount = 0
  playersMax = 5
  isEditorWorld = false
  hardcore = false
  transportLayer = 2

  constructor (obj) {
    Object.assign(this, obj)
  }

  static fromBuffer (buffer) {
    const responsePacket = new ServerData(buffer)

    responsePacket.decode()

    Object.assign(this, responsePacket)

    return this
  }

  toBuffer () {
    const responsePacket = new ServerData()

    responsePacket.version = this.version
    responsePacket.motd = this.motd
    responsePacket.levelName = this.levelName
    responsePacket.gamemodeId = this.gamemodeId
    responsePacket.playerCount = this.playerCount
    responsePacket.playersMax = this.playersMax
    responsePacket.editorWorld = this.isEditorWorld
    responsePacket.hardcore = this.hardcore
    responsePacket.transportLayer = this.transportLayer

    responsePacket.encode()

    return responsePacket.getBuffer()
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
