/* eslint-env jest */

const { timedTest } = require('./internal')
const { Versions } = require('../src/options')
const { sleep } = require('../src/datatypes/util')

describe('internal client/server test', function () {
  const vcount = Object.keys(Versions).length
  this.timeout(vcount * 80 * 1000)

  for (const version in Versions) {
    it('connects ' + version, async () => {
      console.debug(version)
      await timedTest(version)
      await sleep(100)
    })
  }
})
