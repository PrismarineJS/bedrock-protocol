/* eslint-env jest */

const { timedTest } = require('./internal')
const { Versions } = require('../src/options')

describe('internal client/server test', function () {
  this.timeout(220 * 1000)

  for (const version in Versions) {
    it('connects ' + version, async () => {
      console.debug(version)
      await timedTest(version)
    })
  }
})
