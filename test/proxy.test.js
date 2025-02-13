/* eslint-env jest */
const { proxyTest } = require('./proxy')
const { testedVersions } = require('../src/options')
const { sleep } = require('../src/datatypes/util')

describe('proxies client/server', function () {
  const vcount = testedVersions.length
  this.timeout(vcount * 30 * 1000)

  for (const version of testedVersions) {
    it('proxies ' + version, async () => {
      console.debug(version)
      await proxyTest(version)
      await sleep(100)
      console.debug('Done', version)
    })
  }
})
