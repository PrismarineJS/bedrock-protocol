/* eslint-env mocha */
const assert = require('assert')
const { SessionDirectory } = require('../src/client/xboxSession')
const { SessionDirectory: XboxSessionDirectory } = require('prismarine-auth').experimental.xsapi

describe('Minecraft Xbox session adapter', () => {
  it('uses the shared lifecycle and supplies Minecraft title and world properties', async () => {
    const session = new SessionDirectory({}, {
      world: { hostName: 'Host', name: 'World', version: '1.26.45', protocol: 2169, memberCount: 2, maxMemberCount: 8 }
    })
    assert(session instanceof XboxSessionDirectory)
    assert.strictEqual(session.options.titleId, '896928775')
    assert.strictEqual(session.options.scid, '4fc10100-5f7a-4470-899b-280835760c07')
    assert.strictEqual(session.options.templateName, 'MinecraftLobby')
    const writes = []
    session.connect = async () => {
      session.profile = { id: '12345' }
      session.connectionId = 'connection'
    }
    session.client.updateSession = async (name, payload) => { writes.push(payload) }
    session.client.setActivity = async () => {}
    session.client.getSession = async () => ({ properties: writes[0].properties })
    await session.createSession('18446744073709551615')
    assert.deepStrictEqual(writes[0].properties, {
      system: { joinRestriction: 'followed', readRestriction: 'followed', closed: false },
      custom: {
        hostName: 'Host',
        worldName: 'World',
        version: '1.26.45',
        MemberCount: 2,
        MaxMemberCount: 8,
        Joinability: 'joinable_by_friends',
        ownerId: '12345',
        rakNetGUID: '',
        worldType: 'Survival',
        protocol: 2169,
        BroadcastSetting: 3,
        OnlineCrossPlatformGame: true,
        CrossPlayDisabled: false,
        TitleId: 0,
        TransportLayer: 2,
        LanGame: true,
        isEditorWorld: false,
        isHardcore: false,
        SupportedConnections: [{ ConnectionType: 3, HostIpAddress: '', HostPort: 0, NetherNetId: '18446744073709551615' }]
      }
    })
    assert.strictEqual(writes[0].members.me.constants.system.xuid, '12345')
    await session.end()
  })
})
