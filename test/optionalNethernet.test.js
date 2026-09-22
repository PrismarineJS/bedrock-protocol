/* eslint-env mocha */
const assert = require('assert')
const { spawnSync } = require('child_process')
const path = require('path')

describe('Transports without native WebRTC', function () {
  this.timeout(15000)
  it('imports the public API and uses RakNet when the WebRTC binding cannot load', () => {
    const probe = spawnSync(process.execPath, ['-e', `
      const assert = require('assert')
      const Module = require('module')
      const load = Module._load
      let attempts = 0
      Module._load = function (name, ...args) {
        if (name === '@roamhq/wrtc') {
          attempts++
          throw new Error('simulated unavailable WebRTC binding')
        }
        return load.call(this, name, ...args)
      }
      async function main () {
        const api = require(process.cwd())
        const client = new api.Client({ host: '127.0.0.1', port: 19132, offline: true })
        client.close()
        const relay = new api.Relay({ offline: true, destination: { host: '127.0.0.1', port: 19132 } })
        await relay.close()
        const server = api.createServer({ host: '127.0.0.1', port: 0, offline: true })
        server.on('error', error => { throw error })
        await server._listenPromise
        await server.close()
        assert.equal(attempts, 0, 'RakNet must not attempt to load WebRTC')
        const pure = new api.Client({ transport: 'nethernet', nethernet: { networkId: 1n } })
        pure.close()
        assert.equal(attempts, 0, 'Default Nethernet must not load native WebRTC')
        assert.throws(() => new api.Client({ transport: 'nethernet', nethernet: { networkId: 1n, webrtcBackend: 'wrtc' } }), error => {
          assert.match(error.message, /requires a working @roamhq/)
          assert.match(error.cause.message, /simulated unavailable/)
          return true
        })
        assert(attempts > 0)
      }
      main().catch(error => { console.error(error); process.exitCode = 1 })
    `], { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 10000 })
    assert.ifError(probe.error)
    assert.strictEqual(probe.status, 0, probe.stderr + probe.stdout)
  })
})
