const { Versions } = require('../src/options')
const { getFiles } = require('../src/datatypes/util')
const { join } = require('path')

const fileMap = {}

// Walks all the directories for each of the supported versions in options.js
// then builds a file map for each version
// { 'protocol.json': { '1.16.200': '1.16.200/protocol.json', '1.16.210': '1.16.210/...' } }
function loadVersions () {
  for (const version in Versions) {
    let files = []
    try {
      files = getFiles(join(__dirname, '/', version))
    } catch {}
    for (const file of files) {
      const rfile = file.replace(join(__dirname, '/', version), '')
      fileMap[rfile] ??= []
      fileMap[rfile].push([Versions[version], file])
      fileMap[rfile].sort().reverse()
    }
  }
}

module.exports = (protocolVersion) => {
  return {
    // Returns the most recent file based on the specified protocolVersion
    // e.g. if `version` is 1.16 and a file for 1.16 doesn't exist, load from 1.15 file
    getPath (file) {
      if (!fileMap[file]) {
        throw Error('Unknown file ' + file)
      }
      for (const [pver, path] of fileMap[file]) {
        if (pver <= protocolVersion) {
          // console.debug('for', file, 'returining', path)
          return path
        }
      }
      throw Error('unknown file ' + file)
    }
  }
}

loadVersions()
// console.log('file map', fileMap)
// module.exports(Versions['1.16.210']).open('creativeitems.json')
