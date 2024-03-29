/* eslint-env jest */
const { proxyTest } = require('./proxy')
const { testedVersions } = require('../src/options')
const { sleep } = require('../src/datatypes/util')

describe('proxies client/server', function () {
  const vcount = testedVersions.length
  this.timeout(vcount * 7 * 60 * 1000) // upto 7 minutes per version

  for (const version of testedVersions) {
    it('proxies ' + version, async () => {
      console.debug(version)
      await proxyTest(version)
      await sleep(1000)
      console.debug('Done', version)
    })
  }
})
