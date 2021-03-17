/* eslint-env jest */

const { clientTest } = require('./vanilla')

describe('vanilla server test', function () {
  this.timeout(30 * 1000)
  it('client spawns', async () => {
    await clientTest()
  })
})