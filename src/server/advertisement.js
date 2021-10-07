const { Versions, CURRENT_VERSION } = require('../options')

class ServerAdvertisement {
  motd = 'Bedrock Protocol Server'
  levelName = 'bedrock-protocol'
  playersOnline = 0
  playersMax = 5
  gamemode = 'Creative'
  serverId = '0'

  constructor (obj, version = CURRENT_VERSION) {
    if (obj?.name) obj.motd = obj.name
    this.protocol = Versions[version]
    this.version = version
    Object.assign(this, obj)
  }

  fromString (str) {
    const [header, motd, protocol, version, playersOnline, playersMax, serverId, levelName, gamemode] = str.split(';')
    Object.assign(this, { header, motd, protocol, version, playersOnline, playersMax, serverId, levelName, gamemode })
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
      this.gamemode
    ].join(';') + ';'
  }

  toBuffer (version) {
    const str = this.toString(version)
    return Buffer.concat([Buffer.from([0, str.length]), Buffer.from(str)])
  }
}

module.exports = {
  ServerAdvertisement,
  getServerName (client) {
    return new ServerAdvertisement().toBuffer()
  },
  fromServerName (string) {
    return new ServerAdvertisement().fromString(string)
  }
}
