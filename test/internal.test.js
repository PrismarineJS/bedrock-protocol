/* eslint-env jest */
const { timedTest } = require('./internal')
const { testedVersions } = require('../src/options')
const { sleep } = require('../src/datatypes/util')

describe('internal client/server test', function () {
  const vcount = testedVersions.length
  this.timeout(vcount * 7 * 60 * 1000) // upto 7 minutes per version

  for (const version of testedVersions) {
    it('connects ' + version, async () => {
      console.debug(version)
      await timedTest(version)
      await sleep(100)
    })
  }
})
