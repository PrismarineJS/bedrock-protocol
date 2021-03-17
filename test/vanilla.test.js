/* eslint-env jest */

const { clientTest } = require('./vanilla')

describe('vanilla server test', function () {
  this.timeout(120 * 1000)
  it('client spawns', async () => {
    await clientTest()
  })
})