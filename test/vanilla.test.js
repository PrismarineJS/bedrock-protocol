/* eslint-env jest */

const { clientTest } = require('./vanilla')
const { testedVersions } = require('../src/options')
const { sleep } = require('../src/datatypes/util')

describe('vanilla server test', function () {
  const vcount = testedVersions.length
  this.timeout(vcount * 7 * 60 * 1000) // upto 7 minutes per version

  for (const version of testedVersions) {
    it('client spawns ' + version, async () => {
      await clientTest(version)
      await sleep(100)
    })
  }
})
