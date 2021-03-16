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

function waitFor (cb, withTimeout, onTimeout) {
  return Promise.race([
    new Promise((resolve) => cb(resolve)),
    sleep(withTimeout).then(onTimeout)
  ])
}

function serialize (obj = {}, fmt) {
  return JSON.stringify(obj, (k, v) => typeof v === 'bigint' ? v.toString() : v, fmt)
}

function uuidFrom (string) {
  return UUID.v3({ namespace: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', name: string })
}

module.exports = { getFiles, sleep, waitFor, serialize, uuidFrom }
