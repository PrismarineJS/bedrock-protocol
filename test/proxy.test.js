/* eslint-env jest */
const { proxyTest } = require('./proxy')
const { Versions } = require('../src/options')
const { sleep } = require('../src/datatypes/util')

describe('proxies client/server', function () {
  const vcount = Object.keys(Versions).length
  this.timeout(vcount * 30 * 1000)

  for (const version in Versions) {
    it('proxies ' + version, async () => {
      console.debug(version)
      await proxyTest(version)
      await sleep(5000)
      console.debug('Done', version)
    })
  }
})
