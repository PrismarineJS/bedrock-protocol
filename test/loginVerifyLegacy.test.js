/* eslint-env mocha */

const assert = require('assert')
const crypto = require('crypto')
const JWT = require('jsonwebtoken')
const LoginVerify = require('../src/handshake/loginVerify')
const { Player } = require('../src/serverPlayer')
const { ClientStatus } = require('../src/connection')

const VERSION = '1.26.40'

function createKeys () {
  return crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' })
}

function publicKeyBase64 (key) {
  return key.export({ format: 'der', type: 'spki' }).toString('base64')
}

function sign (payload, privateKey, x5u, issuer) {
  const options = {
    algorithm: 'ES384',
    noTimestamp: true,
    header: { x5u, typ: undefined }
  }
  if (issuer) options.issuer = issuer
  return JWT.sign(payload, privateKey, options)
}

function createValidLegacyLogin () {
  const client = createKeys()
  const mojang = createKeys()
  const intermediate = createKeys()
  const clientPublicKey = publicKeyBase64(client.publicKey)
  const mojangPublicKey = publicKeyBase64(mojang.publicKey)
  const intermediatePublicKey = publicKeyBase64(intermediate.publicKey)
  const extraData = {
    displayName: 'VerifiedLegacyPlayer',
    identity: crypto.randomUUID(),
    XUID: '2535427801234567'
  }

  return {
    chain: [
      sign({ certificateAuthority: true, identityPublicKey: mojangPublicKey }, client.privateKey, clientPublicKey),
      sign({ certificateAuthority: true, identityPublicKey: intermediatePublicKey }, mojang.privateKey, 'untrusted-header-value', 'Mojang'),
      sign({ extraData, identityPublicKey: clientPublicKey }, intermediate.privateKey, 'untrusted-header-value', 'Mojang')
    ],
    client,
    clientPublicKey,
    extraData,
    mojangPublicKey,
    skin: sign({ ThirdPartyName: extraData.displayName }, client.privateKey, clientPublicKey)
  }
}

describe('legacy login verification', () => {
  it('accepts a complete chain rooted through the pinned Mojang key', async () => {
    const login = createValidLegacyLogin()
    const client = {}
    LoginVerify(client, null, { offline: false, version: VERSION }, { mojangPublicKey: login.mojangPublicKey })

    const result = await client.decodeLoginJWT(login.chain, login.skin)
    assert.strictEqual(result.key, login.clientPublicKey)
    assert.deepStrictEqual(result.userData.extraData, login.extraData)
    assert.strictEqual(result.skinData.ThirdPartyName, login.extraData.displayName)
  })

  it('rejects a chain whose x5u text names Mojang but whose signatures are attacker-rooted', async () => {
    const attacker = createKeys()
    const trusted = createKeys()
    const attackerPublicKey = publicKeyBase64(attacker.publicKey)
    const trustedPublicKey = publicKeyBase64(trusted.publicKey)
    const extraData = {
      displayName: 'Impostor',
      identity: crypto.randomUUID(),
      XUID: '9000000000000001'
    }
    const forgedChain = [
      sign({ certificateAuthority: true, identityPublicKey: attackerPublicKey }, attacker.privateKey, attackerPublicKey),
      sign({ certificateAuthority: true, identityPublicKey: attackerPublicKey }, attacker.privateKey, trustedPublicKey, 'Mojang'),
      sign({ extraData, identityPublicKey: attackerPublicKey }, attacker.privateKey, trustedPublicKey, 'Mojang')
    ]
    const forgedSkin = sign({ ThirdPartyName: extraData.displayName }, attacker.privateKey, attackerPublicKey)
    const client = {}
    LoginVerify(client, null, { offline: false, version: VERSION }, { mojangPublicKey: trustedPublicKey })

    assert.doesNotThrow(() => JWT.verify(forgedChain[1], attacker.publicKey, { algorithms: ['ES384'] }))
    assert.throws(() => JWT.verify(forgedChain[1], trusted.publicKey, { algorithms: ['ES384'] }), /invalid signature/)
    await assert.rejects(client.decodeLoginJWT(forgedChain, forgedSkin), /not anchored by Mojang/)
  })

  it('stops a forged login before the server handshake and login events', async () => {
    const attacker = createKeys()
    const attackerPublicKey = publicKeyBase64(attacker.publicKey)
    const extraData = {
      displayName: 'Impostor',
      identity: crypto.randomUUID(),
      XUID: '9000000000000001'
    }
    const forgedChain = [
      sign({ certificateAuthority: true, identityPublicKey: attackerPublicKey }, attacker.privateKey, attackerPublicKey),
      sign({ certificateAuthority: true, identityPublicKey: attackerPublicKey }, attacker.privateKey, attackerPublicKey, 'Mojang'),
      sign({ extraData, identityPublicKey: attackerPublicKey }, attacker.privateKey, attackerPublicKey, 'Mojang')
    ]
    const skin = sign({ ThirdPartyName: extraData.displayName }, attacker.privateKey, attackerPublicKey)
    const emitted = []
    const disconnects = []
    const player = {
      address: 'local-regression-test',
      emit: (name, value) => emitted.push([name, value]),
      handleClientProtocolVersion: () => true,
      disconnect: reason => disconnects.push(reason)
    }
    LoginVerify(player, null, { offline: false, version: VERSION })

    await Player.prototype.onLogin.call(player, {
      data: {
        params: {
          protocol_version: 0,
          tokens: {
            identity: JSON.stringify({ Certificate: JSON.stringify({ chain: forgedChain }) }),
            client: skin
          }
        }
      }
    })

    assert.deepStrictEqual(disconnects, ['Server authentication error'])
    assert.deepStrictEqual(emitted.map(([name]) => name), ['loggingIn'])
  })

  it('rejects self-signed and malformed chains when authentication is enabled', async () => {
    const attacker = createKeys()
    const attackerPublicKey = publicKeyBase64(attacker.publicKey)
    const selfSigned = sign({
      identityPublicKey: attackerPublicKey,
      extraData: { displayName: 'Impostor', identity: crypto.randomUUID(), XUID: '1' }
    }, attacker.privateKey, attackerPublicKey)
    const skin = sign({ ThirdPartyName: 'Impostor' }, attacker.privateKey, attackerPublicKey)
    const client = {}
    LoginVerify(client, null, { offline: false, version: VERSION })

    await assert.rejects(client.decodeLoginJWT([selfSigned], skin), /Offline login is not allowed/)
    await assert.rejects(client.decodeLoginJWT([selfSigned, selfSigned], skin), /Unexpected login chain length/)
  })

  it('continues to accept a self-signed one-token chain in offline mode', async () => {
    const local = createKeys()
    const localPublicKey = publicKeyBase64(local.publicKey)
    const extraData = { displayName: 'OfflinePlayer', identity: crypto.randomUUID(), XUID: '0' }
    const chain = sign({ identityPublicKey: localPublicKey, extraData }, local.privateKey, localPublicKey)
    const skin = sign({ ThirdPartyName: extraData.displayName }, local.privateKey, localPublicKey)
    const client = {}
    LoginVerify(client, null, { offline: true, version: VERSION })

    const result = await client.decodeLoginJWT([chain], skin)
    assert.deepStrictEqual(result.userData.extraData, extraData)
  })

  it('uses a verified multiplayer token instead of an accompanying legacy chain', async () => {
    const login = createValidLegacyLogin()
    const service = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const token = JWT.sign({ cpk: login.clientPublicKey, xid: login.extraData.XUID, xname: 'OidcPlayer' }, service.privateKey, {
      algorithm: 'RS256',
      expiresIn: '5m',
      header: { kid: 'test-key', typ: undefined }
    })
    const client = {}
    LoginVerify(client, null, { offline: false, version: VERSION }, {
      verifyOidcToken: value => JWT.verify(value, service.publicKey, { algorithms: ['RS256'] })
    })

    const result = await client.decodeLoginJWT(['deliberately-invalid-legacy-chain'], login.skin, token)
    assert.strictEqual(result.userData.extraData.displayName, 'OidcPlayer')
  })

  it('rejects handshake and initialization packets before login verification', () => {
    for (const packetName of ['client_to_server_handshake', 'set_local_player_as_initialized']) {
      const writes = []
      const emitted = []
      const disconnects = []
      const player = {
        status: ClientStatus.Authenticating,
        awaitingClientHandshake: false,
        encryptionEnabled: false,
        server: {
          deserializer: {
            parsePacketBuffer: () => ({ data: { name: packetName, params: {} } })
          }
        },
        connection: { address: 'local-regression-test' },
        write: name => writes.push(name),
        emit: name => emitted.push(name),
        disconnect: reason => disconnects.push(reason),
        onHandshake: Player.prototype.onHandshake
      }

      Player.prototype.readPacket.call(player, Buffer.alloc(0))

      assert.strictEqual(player.status, ClientStatus.Authenticating)
      assert.deepStrictEqual(writes, [])
      assert.deepStrictEqual(emitted, [])
      assert.deepStrictEqual(disconnects, ['Server authentication error'])
    }
  })
})
