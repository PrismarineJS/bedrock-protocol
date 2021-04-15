/* eslint-env jest */

const { timedTest } = require('./internal')
const { Versions } = require('../src/options')

describe('internal client/server test', function () {
  this.timeout(120 * 1000)

  it('connects', async () => {
    for (const version in Versions) {
      console.debug(version)
      await timedTest(version)
    }
  })
})
