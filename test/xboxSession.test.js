/* eslint-env mocha */
const assert = require('assert')
const { createWorldProperties } = require('../src/client/xboxSession')

describe('Minecraft Xbox session metadata', () => {
  it('preserves Minecraft world properties and a 64-bit network ID', () => {
    const properties = createWorldProperties({ xuid: '12345' }, '18446744073709551615', {
      hostName: 'Host', name: 'World', version: '1.26.45', protocol: 2169, memberCount: 2, maxMemberCount: 8
    })
    assert.deepStrictEqual(properties, {
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
  })
})
