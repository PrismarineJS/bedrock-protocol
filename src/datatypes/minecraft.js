/* eslint-disable */
const nbt = require('prismarine-nbt')
const UUID = require('uuid-1345')

const protoLE = nbt.protos.little
const protoLEV = nbt.protos.littleVarint
// TODO: deal with this:
const zigzag = require('prismarine-nbt/compiler-zigzag')

function readUUID (buffer, offset) {
  if (offset + 16 > buffer.length) { throw new PartialReadError() }
  return {
    value: UUID.stringify(buffer.slice(offset, 16 + offset)),
    size: 16
  }
}

function writeUUID (value, buffer, offset) {
  const buf = UUID.parse(value)
  buf.copy(buffer, offset)
  return offset + 16
}

// Little Endian + varints

function readNbt (buffer, offset) {
  return protoLEV.read(buffer, offset, 'nbt')
}

function writeNbt (value, buffer, offset) {
  return protoLEV.write(value, buffer, offset, 'nbt')
}

function sizeOfNbt (value) {
  return protoLEV.sizeOf(value, 'nbt')
}

// Little Endian

function readNbtLE (buffer, offset) {
  const r = protoLE.read(buffer, offset, 'nbt')
  // End size is 3 for some reason
  if (r.value.type === 'end') return { value: r.value, size: 1 }
  return r
}

function writeNbtLE (value, buffer, offset) {
  if (value.type === 'end') {
    buffer.writeInt8(0, offset)
    return offset + 1
  }
  return protoLE.write(value, buffer, offset, 'nbt')
}

function sizeOfNbtLE (value) {
  if (value.type === 'end') return 1
  return protoLE.sizeOf(value, 'nbt')
}

function readEntityMetadata (buffer, offset, _ref) {
  const type = _ref.type
  const endVal = _ref.endVal

  let cursor = offset
  const metadata = []
  let item
  while (true) {
    if (offset + 1 > buffer.length) throw new PartialReadError()
    item = buffer.readUInt8(cursor)
    if (item === endVal) {
      return {
        value: metadata,
        size: cursor + 1 - offset
      }
    }
    const results = this.read(buffer, cursor, type, {})
    metadata.push(results.value)
    cursor += results.size
  }
}

function writeEntityMetadata (value, buffer, offset, _ref2) {
  const type = _ref2.type
  const endVal = _ref2.endVal

  const self = this
  value.forEach(function (item) {
    offset = self.write(item, buffer, offset, type, {})
  })
  buffer.writeUInt8(endVal, offset)
  return offset + 1
}

function sizeOfEntityMetadata (value, _ref3) {
  const type = _ref3.type

  let size = 1
  for (let i = 0; i < value.length; ++i) {
    size += this.sizeOf(value[i], type, {})
  }
  return size
}

function readIpAddress (buffer, offset) {
  const address = buffer[offset] + '.' + buffer[offset + 1] + '.' + buffer[offset + 2] + '.' + buffer[offset + 3]
  return {
    size: 4,
    value: address
  }
}

function writeIpAddress (value, buffer, offset) {
  const address = value.split('.')

  address.forEach(function (b) {
    buffer[offset] = parseInt(b)
    offset++
  })

  return offset
}

function readEndOfArray (buffer, offset, typeArgs) {
  const type = typeArgs.type
  let cursor = offset
  const elements = []
  while (cursor < buffer.length) {
    const results = this.read(buffer, cursor, type, {})
    elements.push(results.value)
    cursor += results.size
  }
  return {
    value: elements,
    size: cursor - offset
  }
}

function writeEndOfArray (value, buffer, offset, typeArgs) {
  const type = typeArgs.type
  const self = this
  value.forEach(function (item) {
    offset = self.write(item, buffer, offset, type, {})
  })
  return offset
}

function sizeOfEndOfArray (value, typeArgs) {
  const type = typeArgs.type
  let size = 0
  for (let i = 0; i < value.length; ++i) {
    size += this.sizeOf(value[i], type, {})
  }
  return size
}

module.exports = {
  uuid: [readUUID, writeUUID, 16],
  nbt: [readNbt, writeNbt, sizeOfNbt],
  lnbt: [readNbtLE, writeNbtLE, sizeOfNbtLE],
  entityMetadataLoop: [readEntityMetadata, writeEntityMetadata, sizeOfEntityMetadata],
  ipAddress: [readIpAddress, writeIpAddress, 4],
  endOfArray: [readEndOfArray, writeEndOfArray, sizeOfEndOfArray],
  zigzag32: zigzag.zigzag32,
  zigzag64: zigzag.zigzag64
}
