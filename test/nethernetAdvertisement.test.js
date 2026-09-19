/* eslint-env mocha */
const assert = require('assert')
const { NethernetServerAdvertisement } = require('../src/server/advertisement')

// discovery response data captured from an official Bedrock Dedicated Server 1.26.51.1 (transport=nethernet, offline mode)
const bds12651 = '0712707269736d6172696e652d6861726e657373a22207312e32362e35310d426564726f636b206c6576656c00140000000001103161633565343831393932633235613008'

describe('nethernet advertisement', () => {
  it('decodes the version 7 layout sent by 1.26.50+ servers', () => {
    const ad = NethernetServerAdvertisement.fromBuffer(Buffer.from(bds12651, 'hex'))
    assert.strictEqual(ad.version, 7)
    assert.strictEqual(ad.motd, 'prismarine-harness')
    assert.strictEqual(ad.protocol, 2193)
    assert.strictEqual(ad.gameVersion, '1.26.51')
    assert.strictEqual(ad.levelName, 'Bedrock level')
    assert.strictEqual(ad.playerCount, 0)
    assert.strictEqual(ad.playersMax, 10)
    assert.strictEqual(ad.gamemodeId, 0)
    assert.strictEqual(ad.acceptsOnlineAuth, false)
    assert.strictEqual(ad.acceptsSelfSignedAuth, true)
    assert.strictEqual(ad.nonce, '1ac5e481992c25a0')
    assert.strictEqual(ad.connectionType, 4)
  })

  it('re-encodes version 7 byte for byte', () => {
    const ad = NethernetServerAdvertisement.fromBuffer(Buffer.from(bds12651, 'hex'))
    assert.strictEqual(ad.toBuffer().toString('hex'), bds12651)
  })

  it('keeps the version 4 layout round-trippable', () => {
    const ad = new NethernetServerAdvertisement({ version: 4, motd: 'old', levelName: 'world', gamemodeId: 1, playerCount: 2, playersMax: 8, hardcore: true })
    const decoded = NethernetServerAdvertisement.fromBuffer(ad.toBuffer())
    assert.deepStrictEqual(decoded.toBuffer(), ad.toBuffer())
    assert.strictEqual(decoded.hardcore, true)
    assert.strictEqual(decoded.playersMax, 8)
  })

  it('defaults a new advertisement to version 7 with the current protocol', () => {
    const ad = new NethernetServerAdvertisement('motd', '1.26.45')
    assert.strictEqual(ad.version, 7)
    assert.strictEqual(ad.gameVersion, '1.26.45')
    assert.strictEqual(ad.protocol, 2169)
    assert.strictEqual(NethernetServerAdvertisement.fromBuffer(ad.toBuffer()).motd, 'motd')
  })
})
