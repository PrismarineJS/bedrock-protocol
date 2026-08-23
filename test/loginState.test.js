/* eslint-env mocha */

const assert = require('assert')
const crypto = require('crypto')
const { ClientStatus } = require('../src/connection')
const { Player } = require('../src/serverPlayer')
const { LoginPhase, LoginState, ProtocolStateError } = require('../src/auth/loginState')

function loginPacket () {
  return {
    data: {
      params: {
        protocol_version: 0,
        tokens: {
          identity: JSON.stringify({ Token: 'synthetic-token' }),
          client: 'synthetic-client-data'
        }
      }
    }
  }
}

function verifiedLogin () {
  const keyPair = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' })
  return {
    authentication: { authenticated: true, method: 'oidc', issuer: 'test' },
    identity: {
      XUID: '2535427801234567',
      displayName: 'VerifiedPlayer',
      identity: crypto.randomUUID()
    },
    clientPublicKey: keyPair.publicKey,
    clientData: { DeviceOS: 7 }
  }
}

function fakePlayer (verifyLogin) {
  const writes = []
  const emitted = []
  const disconnects = []
  const player = {
    address: 'local-state-test',
    status: ClientStatus.Authenticating,
    loginState: new LoginState(),
    loginVerifier: { verifyLogin },
    keyExchange: {
      createServerHandshake: () => ({
        token: 'server-handshake',
        sharedSecret: Buffer.alloc(48),
        secretKeyBytes: Buffer.alloc(32),
        iv: Buffer.alloc(16)
      })
    },
    handleClientProtocolVersion: () => true,
    write: (name, params) => writes.push([name, params]),
    enableEncryption: () => { player.encryptionEnabled = true },
    emit: (name, value) => emitted.push([name, value]),
    disconnect: reason => disconnects.push(reason),
    rejectLogin: Player.prototype.rejectLogin
  }
  return { player, writes, emitted, disconnects }
}

describe('login state', () => {
  it('permits only the defined phase sequence', () => {
    const state = new LoginState()
    assert.strictEqual(state.phase, LoginPhase.AwaitingLogin)
    assert.throws(() => state.transition(LoginPhase.Complete), ProtocolStateError)
    state.transition(LoginPhase.VerifyingLogin)
    state.transition(LoginPhase.AwaitingClientHandshake)
    state.transition(LoginPhase.Complete)
    state.close()
    assert.strictEqual(state.phase, LoginPhase.Closed)
  })

  it('commits verified identity before awaiting the encrypted acknowledgement', async () => {
    const verified = verifiedLogin()
    const { player, writes, emitted, disconnects } = fakePlayer(async () => verified)

    await Player.prototype.onLogin.call(player, loginPacket())

    assert.strictEqual(player.loginState.phase, LoginPhase.AwaitingClientHandshake)
    assert.deepStrictEqual(player.authentication, verified.authentication)
    assert.deepStrictEqual(player.userData, verified.identity)
    assert.strictEqual(player.encryptionEnabled, true)
    assert.deepStrictEqual(writes.map(([name]) => name), ['server_to_client_handshake'])
    assert.deepStrictEqual(emitted.map(([name]) => name), ['loggingIn', 'login'])
    assert.deepStrictEqual(disconnects, [])

    player.onHandshake = Player.prototype.onHandshake
    assert.strictEqual(player.onHandshake(), true)
    assert.strictEqual(player.loginState.phase, LoginPhase.Complete)
    assert.strictEqual(player.status, ClientStatus.Initializing)
    assert.deepStrictEqual(emitted.map(([name]) => name), ['loggingIn', 'login', 'join'])
  })

  it('makes duplicate login rejection terminal while verification is pending', async () => {
    let resolveVerification
    const pending = new Promise(resolve => { resolveVerification = resolve })
    const { player, writes, emitted, disconnects } = fakePlayer(() => pending)

    const first = Player.prototype.onLogin.call(player, loginPacket())
    await Player.prototype.onLogin.call(player, loginPacket())
    assert.strictEqual(player.loginState.phase, LoginPhase.Rejected)
    assert.deepStrictEqual(disconnects, ['Server authentication error'])

    resolveVerification(verifiedLogin())
    await first

    assert.strictEqual(player.loginState.phase, LoginPhase.Rejected)
    assert.deepStrictEqual(writes, [])
    assert.deepStrictEqual(emitted.map(([name]) => name), ['loggingIn'])
  })
})
