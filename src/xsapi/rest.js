const { stringify } = require('json-bigint')
const { default: fetch } = require('node-fetch')
const { checkStatus } = require('../datatypes/util')

const SessionConfig = {
  MinecraftTitleID: '896928775',
  MinecraftSCID: '4fc10100-5f7a-4470-899b-280835760c07',
  MinecraftTemplateName: 'MinecraftLobby'
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

const isXuid = xuid => /^\d{16}$/.test(xuid)

class Rest {
  constructor (authflow, options = {}) {
    this.authflow = authflow
    this.options = options
  }

  async get (url, config = {}) {
    return await this._request('GET', { url, ...config })
  }

  async post (url, config = {}) {
    return await this._request('POST', { url, ...config })
  }

  async put (url, config = {}) {
    return await this._request('PUT', { url, ...config })
  }

  async delete (url, config = {}) {
    return await this._request('DELETE', { url, ...config })
  }

  async _request (method, config) {
    const auth = await this.authflow.getXboxToken('http://xboxlive.com')

    const payload = {
      method,
      url: config.url,
      headers: {
        authorization: `XBL3.0 x=${auth.userHash};${auth.XSTSToken}`,
        'accept-language': 'en-US',
        ...config.headers
      },
      data: undefined
    }

    if (config.contractVersion) payload.headers['x-xbl-contract-version'] = config.contractVersion
    if (config.data) payload.body = stringify(config.data)

    return fetch(payload.url, payload).then(checkStatus)
  }

  async getProfile (input) {
    input = input === 'me' ? 'me' : isXuid(input) ? `xuids(${input})` : `gt(${encodeURIComponent(input)})`
    const response = await this.get(`https://profile.xboxlive.com/users/${input}/settings`, { contractVersion: '2' })

    return response.profileUsers[0]
  }

  async sendHandle (payload) {
    return this.post('https://sessiondirectory.xboxlive.com/handles', {
      data: payload,
      contractVersion: '107'
    })
  }

  async setActivity (sessionName) {
    return this.sendHandle({
      version: 1,
      type: 'activity',
      sessionRef: { scid: SessionConfig.MinecraftSCID, templateName: SessionConfig.MinecraftTemplateName, name: sessionName }
    })
  }

  async sendInvite (sessionName, xuid) {
    return this.sendHandle({
      version: 1,
      type: 'invite',
      sessionRef: { scid: SessionConfig.MinecraftSCID, templateName: SessionConfig.MinecraftTemplateName, name: sessionName },
      invitedXuid: xuid,
      inviteAttributes: { titleId: SessionConfig.MinecraftTitleID }
    })
  }

  async getSessions (xuid) {
    const response = await this.post('https://sessiondirectory.xboxlive.com/handles/query?include=relatedInfo,customProperties', {
      data: {
        type: 'activity',
        scid: SessionConfig.MinecraftSCID,
        owners: {
          people: {
            moniker: 'people',
            monikerXuid: xuid
          }
        }
      },
      contractVersion: '107'
    })

    return response.results
  }

  async getSession (sessionName) {
    const response = await this.get(`https://sessiondirectory.xboxlive.com/serviceconfigs/${SessionConfig.MinecraftSCID}/sessionTemplates/${SessionConfig.MinecraftTemplateName}/sessions/${sessionName}`, {
      contractVersion: '107'
    })

    return response
  }

  async updateSession (sessionName, payload) {
    const response = await this.put(`https://sessiondirectory.xboxlive.com/serviceconfigs/${SessionConfig.MinecraftSCID}/sessionTemplates/${SessionConfig.MinecraftTemplateName}/sessions/${sessionName}`, {
      data: payload,
      contractVersion: '107'
    })

    return response
  }

  async updateMemberCount (sessionName, count, maxCount) {
    const payload = maxCount ? { MemberCount: count, MaxMemberCount: maxCount } : { MemberCount: count }
    await this.updateSession(sessionName, { properties: { custom: payload } })
  }

  async addConnection (sessionName, xuid, connectionId, subscriptionId) {
    const payload = {
      members: {
        me: {
          constants: { system: { xuid, initialize: true } },
          properties: {
            system: { active: true, connection: connectionId, subscription: { id: subscriptionId, changeTypes: ['everything'] } }
          }
        }
      }
    }

    await this.updateSession(sessionName, payload)
  }

  async updateConnection (sessionName, connectionId) {
    const payload = {
      members: { me: { properties: { system: { active: true, connection: connectionId } } } }
    }

    await this.updateSession(sessionName, payload)
  }

  async leaveSession (sessionName) {
    await this.updateSession(sessionName, { members: { me: null } })
  }
}

module.exports = { Rest, Joinability, JoinabilityConfig, SessionConfig, isXuid }
