class ServerName {
  motd = 'Bedrock Protocol Server'
  name = 'bedrock-protocol'
  protocol = 408
  version = '1.16.20'
  players = {
    online: 0,
    max: 5
  }

  gamemode = 'Creative'
  serverId = '0'

  fromString (str) {
    const [header, motd, protocol, version, playersOnline, playersMax, serverId, name, gamemode] = str.split(';')
    if (playersOnline) this.players.online = playersOnline
    if (playersMax) this.players.max = playersMax
    Object.assign(this, { header, motd, protocol, version, serverId, name, gamemode })
    return this
  }

  toString (version) {
    return [
      'MCPE',
      this.motd,
      this.protocol,
      this.version,
      this.players.online,
      this.players.max,
      this.serverId,
      this.name,
      this.gamemode
    ].join(';') + ';'
  }

  toBuffer (version) {
    const str = this.toString(version)
    return Buffer.concat([Buffer.from([0, str.length]), Buffer.from(str)])
  }
}

module.exports = {
  ServerName,
  getServerName (client) {
    return new ServerName().toBuffer()
  },
  fromServerName (string) {
    return new ServerName().fromString(string)
  }
}
