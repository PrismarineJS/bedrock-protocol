const BinaryStream = require('@jsprismarine/jsbinaryutils').default

class ServerData extends BinaryStream {
  encode () {
    this.writeByte(this.version)
    this.writeString(this.motd)
    this.writeString(this.levelName)
    this.writeIntLE(this.gamemodeId)
    this.writeIntLE(this.playerCount)
    this.writeIntLE(this.playersMax)
    this.writeBoolean(this.isEditorWorld)
    this.writeBoolean(this.hardcore)
    this.writeIntLE(this.transportLayer)
  }

  decode () {
    this.version = this.readByte()
    this.motd = this.readString()
    this.levelName = this.readString()
    this.gamemodeId = this.readIntLE()
    this.playerCount = this.readIntLE()
    this.playersMax = this.readIntLE()
    this.isEditorWorld = this.readBoolean()
    this.hardcore = this.readBoolean()
    this.transportLayer = this.readIntLE()
  }

  readString () {
    return this.read(this.readByte()).toString()
  }

  writeString (v) {
    this.writeByte(Buffer.byteLength(v))
    this.write(Buffer.from(v, 'utf-8'))
  }

  prependLength () {
    const buf = Buffer.alloc(2)
    buf.writeUInt16LE(this.binary.length, 0)
    this.binary = [...buf, ...this.binary]
    this.writeIndex += 2
  }
}

module.exports = { ServerData }
