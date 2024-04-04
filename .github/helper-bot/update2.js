/* eslint-disable no-tabs */
const { join } = require('path')
const fs = require('fs')

// 00ba0080
function loadRoDataHexDump (filePath) {
  const rodataHexDump = fs.readFileSync(filePath)
  const buffer = rodataHexDump
  const initialBufferOffset = Buffer.from(rodataHexDump.slice(-8).toString('latin1'), 'latin1').readUInt32BE(0)

  function readStringNTFromHexDump (addr) {
    const addrNum = typeof addr === 'string' ? parseInt(addr, 16) : addr
    const startIx = addrNum - initialBufferOffset
    const endIx = buffer.indexOf(0, startIx)
    if (endIx === -1) return null
    return buffer.toString('latin1', startIx, endIx)
  }
  function readFloatLEFromHexDump (addr) {
    const addrNum = typeof addr === 'string' ? parseInt(addr, 16) : addr
    const startIx = addrNum - initialBufferOffset
    return buffer.readFloatLE(startIx)
  }
  function readDoubleLEFromHexDump (addr) {
    const addrNum = typeof addr === 'string' ? parseInt(addr, 16) : addr
    const startIx = addrNum - initialBufferOffset
    return buffer.readDoubleLE(startIx)
  }
  function readIntLEFromHexDump (addr) {
    const addrNum = typeof addr === 'string' ? parseInt(addr, 16) : addr
    const startIx = addrNum - initialBufferOffset
    return buffer.readInt32LE(startIx)
  }
  function readI64LEFromHexDump (addr) {
    const addrNum = typeof addr === 'string' ? parseInt(addr, 16) : addr
    const startIx = addrNum - initialBufferOffset
    return buffer.readBigInt64LE(startIx)
  }
  return { buffer, initialBufferOffset, readStringNTFromHexDump, readFloatLEFromHexDump, readDoubleLEFromHexDump, readIntLEFromHexDump, readI64LEFromHexDump }
}

function writeStringsTSV (rodataDump, stringsFile) {
  const { readStringNTFromHexDump } = loadRoDataHexDump(rodataDump, stringsFile)

  let result = ''
  const strings = fs.readFileSync(stringsFile, 'utf8')
  for (let i = 0; i < strings.length; i++) {
    const endIx = strings.indexOf('\n', i)
    // split the sub string by spaces
    const subStr = strings.substring(i, endIx)
    const split = subStr.split(' ')
    const address = split.find(s => s.startsWith('0x'))
    const contents = subStr.split('ascii')[1]?.trim()
    if (!contents || !contents.match(/^[a-zA-Z0-9_:]+$/) || contents.length > 64) {
      if (subStr.includes('utf16le')) {
        // unfortunately some ascii strings are incorrectly written as utf16le
        const contents16 = subStr.split('utf16le')[1]?.trim()
        for (let j = 0; j < contents16.length; j += 1) {
          // write each char one by one as 1 length string
          const newAddress = `0x${(parseInt(address, 16) + (j * 2)).toString(16).padStart(8, '0')}`
          result += `# fromU16LE ${address}\n`
          const ntString = readStringNTFromHexDump(newAddress)
          if (ntString && ntString.match(/^[a-zA-Z0-9_:]+$/) && ntString.length < 64) {
            result += `${newAddress}\t${ntString}\n`
          }
        }
      }
    } else {
      result += `${address}\t${contents}\n`
    }
    i = endIx
  }
  fs.writeFileSync('strings.tsv', result)
}

if (process.argv.length < 2) {
  console.log('Usage: node extract.js <stage0|stage3>')
  process.exit(1)
}

function postProc (rodataDump, s1file) {
  const { readFloatLEFromHexDump } = loadRoDataHexDump(rodataDump)
  const stage2 = fs.readFileSync(s1file, 'latin1')
  let result = ''
  for (const line of stage2.split('\n')) {
    const slices = line.split('\t')
    if (slices[0] === 'BlockData') {
      // console.log(slices)
      try {
        const float = readFloatLEFromHexDump(parseInt(slices[3]))
        console.log('BlockExtraData', slices[1], float)
        result += `BlockExtraData\t${slices[1]}\t${float}\n`
      } catch (e) {
        result += `BlockExtraData\t${slices[1]}\t${0}\n`
      }
    }
  }
  fs.writeFileSync('stage3.txt', result)
}

const stage = process.argv[2]
if (stage === '-s0') {
  writeStringsTSV(
    join(__dirname, 'rodata.bin'),
    join(__dirname, 'strings.txt')
  )
} else if (stage === '-s3') {
  postProc(
    join(__dirname, 'rodata.bin'),
    join(__dirname, 'stage1.txt')
  )
}
