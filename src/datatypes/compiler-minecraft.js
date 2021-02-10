const UUID = require('uuid-1345')
const minecraft = require('./minecraft')

module.exports = {
  Read: {
    UUID: ['native', (buffer, offset) => {
      return {
        value: UUID.stringify(buffer.slice(offset, 16 + offset)),
        size: 16
      }
    }],
    restBuffer: ['native', (buffer, offset) => {
      return {
        value: buffer.slice(offset),
        size: buffer.length - offset
      }
    }],
    nbt: ['native', minecraft.nbt[0]]
  },
  Write: {
    UUID: ['native', (value, buffer, offset) => {
      const buf = UUID.parse(value)
      buf.copy(buffer, offset)
      return offset + 16
    }],
    restBuffer: ['native', (value, buffer, offset) => {
      value.copy(buffer, offset)
      return offset + value.length
    }],
    nbt: ['native', minecraft.nbt[1]]
  },
  SizeOf: {
    UUID: ['native', 16],
    restBuffer: ['native', (value) => {
      return value.length
    }],
    nbt: ['native', minecraft.nbt[2]]
  }
}
