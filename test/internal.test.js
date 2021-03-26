/* eslint-env jest */

const { timedTest } = require('./internal')

describe('internal client/server test', function () {
  this.timeout(120 * 1000)

  it('connects', async () => {
    await timedTest()
  })
})
