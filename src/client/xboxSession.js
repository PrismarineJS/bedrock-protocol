const { SessionDirectory: XboxSessionDirectory } = require('prismarine-auth').experimental.xsapi

const title = {
  titleId: '896928775',
  scid: '4fc10100-5f7a-4470-899b-280835760c07',
  templateName: 'MinecraftLobby'
}

const Joinability = {
  /**
   * Only players who have been invited can join the session.
   * */
  InviteOnly: 'invite_only',
  /**
   * Friends of the authenticating account can join/view the session without an invite.
   * */
  FriendsOnly: 'friends_only',
  /**
   * Anyone that's a friend or friend of a friend can join/view the session without an invite.
   * @default
   * */
  FriendsOfFriends: 'friends_of_friends'
}

const JoinabilityConfig = {
  [Joinability.InviteOnly]: {
    joinability: 'invite_only',
    joinRestriction: 'local',
    broadcastSetting: 1
  },
  [Joinability.FriendsOnly]: {
    joinability: 'joinable_by_friends',
    joinRestriction: 'followed',
    broadcastSetting: 2
  },
  [Joinability.FriendsOfFriends]: {
    joinability: 'joinable_by_friends',
    joinRestriction: 'followed',
    broadcastSetting: 3
  }
}

// Minecraft-specific properties; Xbox requests and lifecycle live in prismarine-auth.
class SessionDirectory extends XboxSessionDirectory {
  constructor (authflow, options = {}) {
    super(authflow, {
      ...title,
      ...options,
      joinability: options.joinability ?? Joinability.FriendsOfFriends,
      world: {
        hostName: 'Bedrock Protocol Server',
        name: 'bedrock-protocol',
        version: '1.21.20',
        memberCount: 0,
        maxMemberCount: 10,
        ...options.world
      }
    })
  }

  createSession (networkId) {
    this.options.networkId = networkId
    return super.createSession(({ profile }) => this.createProperties(profile))
  }

  createProperties (profile) {
    const joinability = JoinabilityConfig[this.options.joinability]

    return {
      system: {
        joinRestriction: joinability.joinRestriction,
        readRestriction: 'followed',
        closed: false
      },
      custom: {
        hostName: String(this.options.world.hostName),
        worldName: String(this.options.world.name),
        version: String(this.options.world.version),
        MemberCount: Number(this.options.world.memberCount),
        MaxMemberCount: Number(this.options.world.maxMemberCount),
        Joinability: joinability.joinability,
        ownerId: profile.id,
        rakNetGUID: '',
        worldType: 'Survival',
        protocol: Number(this.options.world.protocol),
        BroadcastSetting: joinability.broadcastSetting,
        OnlineCrossPlatformGame: true,
        CrossPlayDisabled: false,
        TitleId: 0,
        TransportLayer: 2,
        LanGame: true,
        isEditorWorld: false,
        isHardcore: false,
        SupportedConnections: [
          {
            ConnectionType: 3,
            HostIpAddress: '',
            HostPort: 0,
            NetherNetId: this.options.networkId
          }
        ]
      }
    }
  }
}

module.exports = { SessionDirectory }
