/* eslint-env mocha */
// Regression test for the RakNet shutdown crash: the client/server close handlers used to read
// `peer.nethernet.session` unconditionally, but RakNet peers have no `nethernet`, so closing a RakNet client or server
// threw "Cannot read properties of undefined (reading 'session')" and left sockets/timers open. cleanupNethernet must
// be a no-op for RakNet peers and must run both teardown steps even if one throws.
const assert = require('assert')
const { cleanupNethernet } = require('../src/nethernet')

describe('cleanupNethernet', function () {
  it('is a no-op for a RakNet peer with no nethernet', function () {
    assert.doesNotThrow(() => cleanupNethernet({}))
    assert.doesNotThrow(() => cleanupNethernet(undefined))
    assert.doesNotThrow(() => cleanupNethernet({ nethernet: {} }))
  })

  it('ends the session and destroys signalling for a NetherNet peer', function () {
    let ended = false
    let destroyed = false
    cleanupNethernet({ nethernet: { session: { end () { ended = true } }, signalling: { destroy () { destroyed = true } } } })
    assert.strictEqual(ended, true)
    assert.strictEqual(destroyed, true)
  })

  it('still destroys signalling when ending the session throws', function () {
    let destroyed = false
    assert.doesNotThrow(() => cleanupNethernet({
      nethernet: { session: { end () { throw new Error('already ended') } }, signalling: { destroy () { destroyed = true } } }
    }))
    assert.strictEqual(destroyed, true, 'signalling.destroy must still run after session.end throws')
  })
})
