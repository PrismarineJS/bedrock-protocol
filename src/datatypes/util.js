const fs = require('fs')

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

function waitFor (cb, withTimeout) {
  return Promise.race([
    new Promise((resolve) => cb(resolve)),
    sleep(withTimeout)
  ])
}

function serialize (obj = {}, fmt) {
  return JSON.stringify(obj, (k, v) => typeof v === 'bigint' ? v.toString() : v, fmt)
}

module.exports = { getFiles, sleep, waitFor, serialize }
