/* eslint-env jest */

const { timedTest } = require('./internal')
const { proxyTest } = require('./proxy')
const { Versions } = require('../src/options')

describe('internal client/server test', function () {
  this.timeout(240 * 1000)

  for (const version in Versions) {
    it('connects ' + version, async () => {
      console.debug(version)
      await timedTest(version)
    })
  }

  for (const version in Versions) {
    it('proxies ' + version, async () => {
      console.debug(version)
      await proxyTest(version)
    })
  }
})
