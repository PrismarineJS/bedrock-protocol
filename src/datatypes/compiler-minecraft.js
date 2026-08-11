/* eslint-disable */
const UUID = require('uuid-1345')
const minecraft = require('./minecraft')
const [Read, Write, SizeOf] = [{}, {}, {}]

/**
 * UUIDs
 */
Read.uuid = ['native', (buffer, offset) => {
  return {
    value: UUID.stringify(buffer.slice(offset, 16 + offset)),
    size: 16
  }
}]
Write.uuid = ['native', (value, buffer, offset) => {
  const buf = UUID.parse(value)
  buf.copy(buffer, offset)
  return offset + 16
}]
SizeOf.uuid = ['native', 16]

/**
 * Rest of buffer
 */
Read.restBuffer = ['native', (buffer, offset) => {
  return {
    value: buffer.slice(offset),
    size: buffer.length - offset
  }
}]
Write.restBuffer = ['native', (value, buffer, offset) => {
  value.copy(buffer, offset)
  return offset + value.length
}]
SizeOf.restBuffer = ['native', (value) => {
  return value.length
}]

/**
 * A length-prefixed array that treats the declared count as an upper bound
 * while reading. This is useful for packets that are already bounded by the
 * transport but whose producer may over-report the element count.
 *
 * Writing and sizing remain identical to an ordinary ProtoDef array.
 */
Read.maybeIncompleteArray = ['parametrizable', (compiler, { countType, type }) => {
  return compiler.wrapCode(`
  const { value: count, size: countSize } = ${compiler.callType(countType)}
  if (count > 0xffffff && !ctx.noArraySizeCheck) throw new Error("array size is abnormally large, not reading: " + count)
  const data = []
  let size = countSize
  for (let i = 0; i < count && offset + size < buffer.length; i++) {
    const elem = ${compiler.callType(type, 'offset + size')}
    data.push(elem.value)
    size += elem.size
  }
  return { value: data, size }
`.trim())
}]
Write.maybeIncompleteArray = ['parametrizable', (compiler, { countType, type }) => {
  return compiler.wrapCode(`
  offset = ${compiler.callType('value.length', countType)}
  for (let i = 0; i < value.length; i++) {
    offset = ${compiler.callType('value[i]', type)}
  }
  return offset
`.trim())
}]
SizeOf.maybeIncompleteArray = ['parametrizable', (compiler, { countType, type }) => {
  return compiler.wrapCode(`
  let size = ${compiler.callType('value.length', countType)}
  for (let i = 0; i < value.length; i++) {
    size += ${compiler.callType('value[i]', type)}
  }
  return size
`.trim())
}]

/**
 * A terminal field that is present only when unread packet bytes remain.
 */
Read.optionalOnRemaining = ['parametrizable', (compiler, { type }) => {
  return compiler.wrapCode(`
  if (offset >= buffer.length) return { value: undefined, size: 0 }
  return ${compiler.callType(type)}
`.trim())
}]
Write.optionalOnRemaining = ['parametrizable', (compiler, { type }) => {
  return compiler.wrapCode(`
  if (value === undefined) return offset
  return ${compiler.callType('value', type)}
`.trim())
}]
SizeOf.optionalOnRemaining = ['parametrizable', (compiler, { type }) => {
  return compiler.wrapCode(`
  if (value === undefined) return 0
  return ${compiler.callType('value', type)}
`.trim())
}]

/**
 * Encapsulated data with length prefix
 */
Read.encapsulated = ['parametrizable', (compiler, { lengthType, type }) => {
  return compiler.wrapCode(`
  const payloadSize = ${compiler.callType(lengthType, 'offset')}
  if (payloadSize.value === 0) {
    return { value: undefined, size: payloadSize.size }
  }
  const { value, size } = ctx.${type}(buffer, offset + payloadSize.size)
  return { value, size: size + payloadSize.size }
`.trim())
}]
Write.encapsulated = ['parametrizable', (compiler, { lengthType, type }) => {
  return compiler.wrapCode(`
  if (value === undefined) {
    return (ctx.${lengthType})(0, buffer, offset)
  }
  const buf = Buffer.allocUnsafe(buffer.length - offset)
  const payloadSize = (ctx.${type})(value, buf, 0)
  let size = (ctx.${lengthType})(payloadSize, buffer, offset)
  size += buf.copy(buffer, size, 0, payloadSize)
  return size
`.trim())
}]
SizeOf.encapsulated = ['parametrizable', (compiler, { lengthType, type }) => {
  return compiler.wrapCode(`
    if (value === undefined) {
      return (ctx.${lengthType})(0)
    }
    const payloadSize = (ctx.${type})(value)
    return (ctx.${lengthType})(payloadSize) + payloadSize
`.trim())
}]

/**
 * Read NBT until end of buffer or \0
 */
Read.nbtLoop = ['context', (buffer, offset) => {
  const values = []
  while (buffer[offset] != 0) {
    const n = ctx.nbt(buffer, offset)
    values.push(n.value)
    offset += n.size
  }
  return { value: values, size: buffer.length - offset }
}]
Write.nbtLoop = ['context', (value, buffer, offset) => {
  for (const val of value) {
    offset = ctx.nbt(val, buffer, offset)
  }
  buffer.writeUint8(0, offset)
  return offset + 1
}]
SizeOf.nbtLoop = ['context', (value, buffer, offset) => {
  let size = 1
  for (const val of value) {
    size += ctx.nbt(val, buffer, offset)
  }
  return size
}]

/**
 * Read rotation float encoded as a byte
 */
Read.byterot = ['context', (buffer, offset) => {
  const val = buffer.readUint8(offset)
  return { value: (val * (360 / 256)), size: 1 }
}]
Write.byterot = ['context', (value, buffer, offset) => {
  const val = (value / (360 / 256))
  buffer.writeUint8(val, offset)
  return offset + 1
}]
SizeOf.byterot = ['context', (value, buffer, offset) => {
  return 1
}]

/**
 * NBT
 */
Read.nbt = ['native', minecraft.nbt[0]]
Write.nbt = ['native', minecraft.nbt[1]]
SizeOf.nbt = ['native', minecraft.nbt[2]]

Read.lnbt = ['native', minecraft.lnbt[0]]
Write.lnbt = ['native', minecraft.lnbt[1]]
SizeOf.lnbt = ['native', minecraft.lnbt[2]]

/**
 * Command Packet
 * - used for determining the size of the following enum
 */
Read.enum_size_based_on_values_len = ['parametrizable', (compiler) => {
  return compiler.wrapCode(js(() => {
    if (values_len <= 0xff) return { value: 'byte', size: 0 }
    if (values_len <= 0xffff) return { value: 'short', size: 0 }
    if (values_len <= 0xffffff) return { value: 'int', size: 0 }
  }))
}]
Write.enum_size_based_on_values_len = ['parametrizable', (compiler) => {
  return str(() => {
    if (value.values_len <= 0xff) _enum_type = 'byte'
    else if (value.values_len <= 0xffff) _enum_type = 'short'
    else if (value.values_len <= 0xffffff) _enum_type = 'int'
    return offset
  })
}]
SizeOf.enum_size_based_on_values_len = ['parametrizable', (compiler) => {
  return str(() => {
    if (value.values_len <= 0xff) _enum_type = 'byte'
    else if (value.values_len <= 0xffff) _enum_type = 'short'
    else if (value.values_len <= 0xffffff) _enum_type = 'int'
    return 0
  })
}]

function js (fn) {
  return fn.toString().split('\n').slice(1, -1).join('\n').trim()
}

function str (fn) {
  return fn.toString() + ')();(()=>{}'
}

module.exports = { Read, Write, SizeOf }
