/* eslint-env jest */

const { clientTest } = require('./vanilla')
const { Versions } = require('../src/options')
const { sleep } = require('../src/datatypes/util')

describe('vanilla server test', function () {
  const vcount = Object.keys(Versions).length
  this.timeout(vcount * 80 * 1000)

  for (const version in Versions) {
    it('client spawns ' + version, async () => {
      await clientTest(version)
      await sleep(100)
    })
  }
})
