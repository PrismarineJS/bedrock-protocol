const UUID = require('uuid-1345')
const minecraft = require('./minecraft')

const Read = {}
const Write = {}
const SizeOf = {}

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
 * NBT
 */
Read.nbt = ['native', minecraft.nbt[0]]
Write.nbt = ['native', minecraft.nbt[1]]
SizeOf.nbt = ['native', minecraft.nbt[2]]

/**
 * Bits
 */
// nvm,
// Read.bitflags = ['parametrizable', (compiler, { type, flags }) => {
  // return compiler.wrapCode(`
  //   const { value, size } = ${compiler.callType('buffer, offset', type)}
  //   const val = {}
  //   for (let i = 0; i < size; i++) {
  //     const hi = (value >> i) & 1
  //     if ()
  //     const v = value & 
  //     if (flags[i]) 
  //   }
  // `
// }]

Read.bitflags = ['parametrizable', (compiler, { type, flags }) => { 
  return compiler.wrapCode(`
    const { value: _value, size } = ${compiler.callType(type, 'offset')}
    const value = { _value }
    const flags = ${JSON.stringify(flags)}
    for (const key in flags) {
      value[key] = (_value & flags[key]) == flags[key]
    }
    return { value, size }
  `.trim())
}]


Write.bitflags = ['parametrizable', (compiler, { type, flags }) => { 
  return compiler.wrapCode(`
    const flags = ${JSON.stringify(flags)}
    let val = value._value
    for (const key in flags) {
      if (value[key]) val |= flags[key]
    }
    return (ctx.${type})(val, buffer, offset)
  `.trim())
}]

SizeOf.bitflags = ['parametrizable', (compiler, { type, flags }) => { 
  return compiler.wrapCode(`
    const flags = ${JSON.stringify(flags)}
    let val = value._value
    for (const key in flags) {
      if (value[key]) val |= flags[key]
    }
    return (ctx.${type})(val)
  `.trim())
}]

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

function js(fn) {
  return fn.toString().split('\n').slice(1, -1).join('\n').trim()
}

function str(fn) {
  return fn.toString() + ')();(()=>{}'
}

module.exports = { Read, Write, SizeOf }