/* eslint-env jest */

const { timedTest } = require('./internal')
const { testedVersions } = require('../src/options')
const { sleep } = require('../src/datatypes/util')
require('events').captureRejections = true

describe('internal client/server test', function () {
  const vcount = testedVersions.length
  this.timeout(vcount * 80 * 1000)

  for (const version of testedVersions) {
    it('connects ' + version, async () => {
      console.debug(version)
      await timedTest(version)
      await sleep(100)
    })
  }
})
