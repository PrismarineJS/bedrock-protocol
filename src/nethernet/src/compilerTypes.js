/* eslint-disable */
const [Read, Write, SizeOf] = [{}, {}, {}]

/**
 * Skip type - doesn't read/write anything, just passes through the value
 */
Read.skip = ['native', (buffer, offset) => {
  return { value: undefined, size: 0 }
}]
Write.skip = ['native', (value, buffer, offset) => {
  return offset
}]
SizeOf.skip = ['native', (value) => {
  return 0
}]

/**
 * Encapsulated data with length prefix
 */
Read.encapsulated = ['parametrizable', (compiler, { lengthType, type }) => {
  return compiler.wrapCode(`
  const payloadSize = ${compiler.callType(lengthType, 'offset')}
  const { value, size } = ctx.${type}(buffer, offset + payloadSize.size)
  return { value, size: size + payloadSize.size }
`.trim())
}]
Write.encapsulated = ['parametrizable', (compiler, { lengthType, type }) => {
  return compiler.wrapCode(`
  const buf = Buffer.allocUnsafe(buffer.length - offset)
  const payloadSize = (ctx.${type})(value, buf, 0)
  let size = (ctx.${lengthType})(payloadSize, buffer, offset)
  size += buf.copy(buffer, size, 0, payloadSize)

  return size
`.trim())
}]
SizeOf.encapsulated = ['parametrizable', (compiler, { lengthType, type }) => {
  return compiler.wrapCode(`
    const payloadSize = (ctx.${type})(value)
    return (ctx.${lengthType})(payloadSize) + payloadSize
`.trim())
}]

module.exports = { Read, Write, SizeOf }