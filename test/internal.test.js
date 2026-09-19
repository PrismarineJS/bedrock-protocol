/* eslint-env jest */

const { timedTest } = require('./internal')
const { vanillaTest } = require('./vanilla')
const { testedVersions } = require('../src/options')
const { sleep } = require('../src/datatypes/util')
require('events').captureRejections = true

describe('client/server test', function () {
  const vcount = testedVersions.length
  this.timeout(vcount * 80 * 1000)

  for (const version of testedVersions) {
    // Boots the vanilla server once per version and runs the spawn test and
    // the packet dump against it in parallel; the internal test below replays
    // the dumps.
    it('client spawns ' + version, async () => {
      await vanillaTest(version)
      await sleep(100)
    })

    it('connects ' + version, async () => {
      console.debug(version)
      await timedTest(version)
      await sleep(100)
    })
  }
})
