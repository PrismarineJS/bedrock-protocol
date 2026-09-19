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
  it('rejects unknown layouts instead of assuming they match an existing version', () => {
    for (const version of [0, 5, 6, 8, 255]) {
      const bytes = Buffer.from(bds12651, 'hex')
      bytes[0] = version
      assert.throws(() => NethernetServerAdvertisement.fromBuffer(bytes), /Unsupported/)
      assert.throws(() => new NethernetServerAdvertisement({ version }).toBuffer(), /Unsupported/)
    }
  })

  it('enforces version 4 string limits in UTF-8 bytes', () => {
    const ad = new NethernetServerAdvertisement({ version: 4, motd: 'x'.repeat(255) })
    assert.strictEqual(NethernetServerAdvertisement.fromBuffer(ad.toBuffer()).motd, ad.motd)
    for (const motd of ['x'.repeat(256), 'é'.repeat(128)]) {
      assert.throws(() => new NethernetServerAdvertisement({ version: 4, motd }).toBuffer(), /byte limit/)
    }
  })

  it('preserves optional version 4 trailer defaults', () => {
    const bytes = new NethernetServerAdvertisement({ version: 4 }).toBuffer()
    for (let missing = 1; missing <= 4; missing++) {
      const ad = NethernetServerAdvertisement.fromBuffer(bytes.subarray(0, bytes.length - missing))
      assert.strictEqual(ad.unknown2, 8)
      assert.strictEqual(ad.isEditorWorld, false)
    }
  })

  it('rejects truncated version 7 packets and trailing data', () => {
    const bytes = Buffer.from(bds12651, 'hex')
    for (let length = 0; length < bytes.length; length++) {
      assert.throws(() => NethernetServerAdvertisement.fromBuffer(bytes.subarray(0, length)))
    }
    assert.throws(() => NethernetServerAdvertisement.fromBuffer(Buffer.concat([bytes, Buffer.from([0])])), /Trailing/)
  })

  it('rejects overflowing varints and out-of-range integers', () => {
    assert.throws(() => NethernetServerAdvertisement.fromBuffer(Buffer.from([7, 0x80, 0x80, 0x80, 0x80, 0x80, 0])), /32 bits/)
    assert.throws(() => NethernetServerAdvertisement.fromBuffer(Buffer.from([7, 0, 0xff, 0xff, 0xff, 0xff, 0x1f])), /32 bits/)
    for (const playerCount of [2147483648, -2147483649, 1.5, NaN]) {
      assert.throws(() => new NethernetServerAdvertisement({ playerCount }).toBuffer(), /32-bit/)
    }
  })
})
