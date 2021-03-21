/* eslint-env jest */

const { clientTest } = require('./vanilla')
const { Versions } = require('../src/options')

describe('vanilla server test', function () {
  this.timeout(120 * 1000)
  it('client spawns', async () => {
    for (const version in Versions) {
      await clientTest(version) 
    }
  })
})