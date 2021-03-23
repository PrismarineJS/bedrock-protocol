/* eslint-env jest */

const { clientTest } = require('./vanilla')
const { Versions } = require('../src/options')

describe('vanilla server test', function () {
  this.timeout(120 * 1000)

  for (const version in Versions) {
    it('client spawns ' + version, async () => {
      await clientTest(version)
    })
  }
})
