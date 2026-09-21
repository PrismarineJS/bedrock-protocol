// NetherNetId uses type 7; the legacy type 3 advertisement used WebRTCNetworkId.
const NETHERNET_CONNECTION_TYPE = 7

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

// Minecraft metadata stays here; HTTP, RTA and membership live in xbox-services.
function createWorldProperties (profile, networkId, world, joinability = Joinability.FriendsOfFriends) {
  const config = JoinabilityConfig[joinability]
  return {
    system: {
      joinRestriction: config.joinRestriction,
      readRestriction: 'followed',
      closed: false
    },
    custom: {
      hostName: String(world.hostName),
      worldName: String(world.name),
      version: String(world.version),
      MemberCount: Number(world.memberCount),
      MaxMemberCount: Number(world.maxMemberCount),
      Joinability: config.joinability,
      ownerId: profile.xuid,
      rakNetGUID: '',
      worldType: 'Survival',
      protocol: Number(world.protocol),
      BroadcastSetting: config.broadcastSetting,
      OnlineCrossPlatformGame: true,
      CrossPlayDisabled: false,
      TitleId: 0,
      TransportLayer: 2,
      LanGame: true,
      isEditorWorld: false,
      isHardcore: false,
      SupportedConnections: [
        {
          ConnectionType: NETHERNET_CONNECTION_TYPE,
          HostIpAddress: '',
          HostPort: 0,
          NetherNetId: networkId
        }
      ]
    }
  }
}

module.exports = { title, createWorldProperties }
