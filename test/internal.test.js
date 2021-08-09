/* eslint-env jest */

const { timedTest } = require('./internal')
const { proxyTest } = require('./proxy')
const { Versions } = require('../src/options')
const { sleep } = require('../src/datatypes/util')

describe('internal client/server test', function () {
  const vcount = Object.keys(Versions).length
  this.timeout(vcount * 80 * 1000)

  for (const version in Versions) {
    it('connects ' + version, async () => {
      console.debug(version)
      await timedTest(version)
      await sleep(100)
    })
  }

  if (process.env.CI && process.platform === 'linux') {
    // Don't run the test, see :
    // https://github.com/PrismarineJS/bedrock-protocol/issues/124
  } else {
    for (const version in Versions) {
      it('proxies ' + version, async () => {
        console.debug(version)
        await proxyTest(version)
        await sleep(5000)
        console.debug('Done', version)
      })
    }
  }
})
