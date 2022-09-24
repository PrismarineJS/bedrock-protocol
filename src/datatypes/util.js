const fs = require('fs')
const UUID = require('uuid-1345')

function getFiles (dir) {
  let results = []
  const list = fs.readdirSync(dir)
  list.forEach((file) => {
    file = dir + '/' + file
    const stat = fs.statSync(file)
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file))
    } else {
      results.push(file)
    }
  })
  return results
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitFor (cb, withTimeout, onTimeout) {
  let t
  const ret = await Promise.race([
    new Promise((resolve, reject) => cb(resolve, reject)),
    new Promise(resolve => { t = setTimeout(() => resolve('timeout'), withTimeout) })
  ])
  clearTimeout(t)
  if (ret === 'timeout') await onTimeout()
  return ret
}

function serialize (obj = {}, fmt) {
  return JSON.stringify(obj, (k, v) => typeof v === 'bigint' ? v.toString() : v, fmt)
}

function uuidFrom (string) {
  return UUID.v3({ namespace: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', name: string })
}

function nextUUID () {
  return uuidFrom(Date.now().toString())
}

const isDebug = process.env.DEBUG?.includes('minecraft-protocol')

module.exports = { getFiles, sleep, waitFor, serialize, uuidFrom, nextUUID, isDebug }
