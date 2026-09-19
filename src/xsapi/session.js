const { v4 } = require('uuid-1345')
const { EventEmitter } = require('events')
const { XboxRTA } = require('xbox-rta')
const { Rest, Joinability, JoinabilityConfig, isXuid } = require('./rest')

const debug = require('debug')('minecraft-protocol')

class Host {
  constructor (session, authflow) {
    this.session = session

    this.authflow = authflow

    this.rest = new Rest(this.authflow)

    this.subscriptionId = v4()

    this.profile = null

    this.rta = null

    this.connectionId = null
  }

  async connect () {
    this.rta = new XboxRTA(this.authflow)
    try {
      this.profile = await this.rest.getProfile('me')
      this.session.assertActive()
      await this.rta.connect()
      this.session.assertActive()

      const subResponse = await this.rta.subscribe('https://sessiondirectory.xboxlive.com/connections/')
      this.session.assertActive()
      this.connectionId = subResponse.data.ConnectionId

      this.rta.on('subscribe', event => {
        this.onSubscribe(event).catch(error => this.session.emit('error', error))
      })
    } finally {
      // Authentication can finish after end(); do not leave a late socket open.
      if (this.session._ended) await this.close()
    }
  }

  async close () {
    const ws = this.rta?.ws
    // xbox-rta.destroy() only closes OPEN sockets, not CONNECTING sockets.
    if (ws?.readyState === 0) {
      ws.onopen = null
      ws.onclose = null
      ws.on('error', () => {})
      ws.terminate()
    }
    await this.rta?.destroy()
  }

  async onSubscribe (event) {
    if (this.session._ended) return
    const connectionId = event.data?.ConnectionId

    if (connectionId && typeof connectionId === 'string') {
      debug('Received RTA subscribe event', event)

      try {
        this.connectionId = connectionId

        await this.rest.updateConnection(this.session.session.name, connectionId)
        await this.rest.setActivity(this.session.session.name)
      } catch (e) {
        debug('Failed to update connection, session may have been abandoned', e)
        await this.session.end()
        this.session.emit('error', new Error('Xbox session connection was lost', { cause: e }))
      }
    }
  }
}

class SessionDirectory extends EventEmitter {
  constructor (authflow, options = {}) {
    super()
    this._ended = false
    this.options = {
      joinability: Joinability.FriendsOfFriends,
      ...options,
      world: {
        hostName: 'Bedrock Protocol Server',
        name: 'bedrock-protocol',
        version: '1.21.20',
        memberCount: 0,
        maxMemberCount: 10,
        ...options.world
      }
    }

    this.authflow = authflow

    this.host = new Host(this, this.authflow)

    this.session = { name: '' }
  }

  assertActive () {
    if (this._ended) throw new Error('Xbox session is closed')
  }

  async joinSession (sessionName) {
    this.assertActive()
    this.session.name = sessionName

    await this.host.connect()

    await this.host.rest.addConnection(this.session.name, this.host.profile.id, this.host.connectionId, this.host.subscriptionId)
    if (this._ended) await this.host.rest.leaveSession(this.session.name)
    this.assertActive()
    await this.host.rest.setActivity(this.session.name)

    return this.getSession()
  }

  async createSession (networkId) {
    this.assertActive()
    this.options.networkId = networkId

    this.session.name = v4()

    await this.host.connect()

    await this.createAndPublishSession()
  }

  end () {
    if (this._endPromise) return this._endPromise
    this._ended = true
    this._endPromise = this.closeSession()
    return this._endPromise
  }

  async closeSession () {
    try {
      await this.host.close()
    } finally {
      if (this.session.name) {
        await this.host.rest.leaveSession(this.session.name)
          .catch(() => { debug(`Failed to leave session ${this.session.name}`) })
      }
    }
    debug(`Abandoned session, name: ${this.session.name}`)
  }

  async invitePlayer (identifier) {
    debug(`Inviting player, identifier: ${identifier}`)

    if (!isXuid(identifier)) {
      const profile = await this.host.rest.getProfile(identifier)
        .catch(() => { throw new Error(`Failed to get profile for identifier: ${identifier}`) })
      identifier = profile.id
    }

    await this.host.rest.sendInvite(this.session.name, identifier)

    debug(`Invited player, xuid: ${identifier}`)
  }

  async getSession () {
    return await this.host.rest.getSession(this.session.name)
  }

  async updateSession (payload) {
    this.assertActive()
    await this.host.rest.updateSession(this.session.name, payload)
    if (this._ended) {
      await this.host.rest.leaveSession(this.session.name)
      this.assertActive()
    }
  }

  async createAndPublishSession () {
    await this.updateSession(this.createSessionBody())

    debug(`Created session, name: ${this.session.name}`)

    this.assertActive()
    await this.host.rest.setActivity(this.session.name)

    const session = await this.getSession()

    await this.updateSession({ properties: session.properties })

    debug(`Published session, name: ${this.session.name}`)

    return session
  }

  createSessionBody () {
    if (!this.host.connectionId) throw new Error('No session owner')

    const joinability = JoinabilityConfig[this.options.joinability]

    return {
      properties: {
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
          ownerId: this.host.profile.id,
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
      },
      members: {
        me: {
          constants: {
            system: {
              xuid: this.host.profile.id,
              initialize: true
            }
          },
          properties: {
            system: {
              active: true,
              connection: this.host.connectionId,
              subscription: {
                id: this.host.subscriptionId,
                changeTypes: ['everything']
              }
            }
          }
        }
      }
    }
  }
}

module.exports = { SessionDirectory, Host }
