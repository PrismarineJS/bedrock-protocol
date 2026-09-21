const path = require('path')
const { Authflow: PrismarineAuth, Titles } = require('prismarine-auth')
const minecraftFolderPath = require('minecraft-folder-path')
const debug = require('debug')('minecraft-protocol')
const { uuidFrom } = require('../datatypes/util')
const { RealmAPI } = require('prismarine-realms')
const { XboxClient } = require('prismarine-xbox-services')
const { title, createWorldProperties } = require('./xboxSession')

// BDS validates that the login DeviceOS agrees with the platform used to
// authenticate. Values are from the protocol DeviceOS enum.
const deviceOSByAuthTitle = {
  [Titles.MinecraftAndroid]: 1,
  [Titles.MinecraftIOS]: 2,
  [Titles.MinecraftPlaystation]: 11,
  [Titles.MinecraftNintendoSwitch]: 12
}

function validateOptions (options) {
  if (!options.profilesFolder) {
    options.profilesFolder = path.join(minecraftFolderPath, 'nmp-cache')
  }
  if (options.authTitle === undefined) {
    options.authTitle = Titles.MinecraftNintendoSwitch
    options.deviceType = 'Nintendo'
    options.flow = 'live'
  }
  if (options.deviceOS === undefined) {
    options.deviceOS = deviceOSByAuthTitle[options.authTitle]
  }
  if (options.deviceOS === undefined) {
    throw new Error('deviceOS is required when authTitle does not identify a known Minecraft platform')
  }
}

async function serverAuthenticate (server, options) {
  validateOptions(options)

  options.authflow ??= new PrismarineAuth(options.username, options.profilesFolder, options, options.onMsaCode)

  const xbox = new XboxClient(options.authflow, title)
  const controller = new AbortController()
  server.nethernet.sessionAbort = controller
  const session = await xbox.createSession({
    signal: controller.signal,
    properties: ({ profile }) => createWorldProperties(profile, options.nethernet.networkId, {
      hostName: server.advertisement.motd,
      name: server.advertisement.levelName,
      version: options.version,
      protocol: options.protocolVersion,
      memberCount: server.advertisement.playerCount,
      maxMemberCount: server.advertisement.playersMax
    })
  })
  if (server._closed) { await session.close(); return }
  server.nethernet.session = session
  session.on('error', error => server.onConnectionError(error))
  await session.setActivity()
}

async function worldAuthenticate (client, options) {
  validateOptions(options)

  options.authflow ??= new PrismarineAuth(options.username, options.profilesFolder, options, options.onMsaCode)

  options.transport = 'nethernet'
  options.nethernet = { ...options.nethernet, signalling: 'services' }
  client.nethernet ??= {}

  const xbox = new XboxClient(options.authflow, title)
  const controller = new AbortController()
  client.nethernet.sessionAbort = controller
  const requestOptions = { signal: controller.signal }
  const profile = await xbox.getProfile('me', requestOptions)
  if (client._closed) return

  const getSessions = async () => {
    const sessions = await xbox.getActivityHandles(profile.xuid, requestOptions)
    debug('sessions', sessions)
    if (!sessions.length) throw Error('Couldn\'t find any sessions for the authenticated account')
    return sessions
  }

  let world

  if (options.world.pickSession) {
    if (typeof options.world.pickSession !== 'function') throw Error('world.pickSession must be a function')
    const sessions = await getSessions()
    world = await options.world.pickSession(sessions)
  }

  if (!world) throw Error('Couldn\'t find a session to connect to.')

  if (client._closed) return
  const session = await xbox.joinSession(world.sessionRef.name, requestOptions)
  if (client._closed) { await session.close(); return }
  client.nethernet.session = session
  session.on('error', error => client.onConnectionError(error))

  // Select the connection that advertises a NetherNet id. The ConnectionType value for NetherNet is not stable across
  // client versions (a live 1.26.51 host advertises 7, this code assumed 3), so match on the NetherNetId itself.
  const networkId = session.current.properties?.custom?.SupportedConnections?.find(e => e.NetherNetId)?.NetherNetId

  if (!networkId) throw Error('Couldn\'t find a Nethernet ID to connect to.')

  await session.setActivity()
  options.nethernet.networkId = BigInt(networkId)
}

async function realmAuthenticate (options) {
  validateOptions(options)

  options.authflow ??= new PrismarineAuth(options.username, options.profilesFolder, options, options.onMsaCode)

  const version = options.version.startsWith('1.') ? options.version : `1.${options.version}`
  const api = RealmAPI.from(options.authflow, 'bedrock', { minecraftVersion: version })

  const getRealms = async () => {
    const realms = await api.getRealms()
    debug('realms', realms)
    if (!realms.length) throw Error('Couldn\'t find any Realms for the authenticated account')
    return realms
  }

  let realm

  if (options.realms.realmId) {
    const realms = await getRealms()
    realm = realms.find(e => e.id === Number(options.realms.realmId))
  } else if (options.realms.realmInvite) {
    realm = await api.getRealmFromInvite(options.realms.realmInvite)
  } else if (options.realms.pickRealm) {
    if (typeof options.realms.pickRealm !== 'function') throw Error('realms.pickRealm must be a function')
    const realms = await getRealms()
    realm = await options.realms.pickRealm(realms)
  }

  if (!realm) throw Error('Couldn\'t find a Realm to connect to. Authenticated account must be the owner or has been invited to the Realm.')

  const join = await api.rest.get(`/worlds/${realm.id}/join`)

  debug('realms connection', join)

  if (join.networkProtocol === 'NETHERNET_JSONRPC') {
    options.transport = 'nethernet'
    options.nethernet = { ...options.nethernet, networkId: join.address, signalling: 'services' }
    options.skipPing = true
    options.nethernet._signallingProtocol = 'jsonrpc'
    const region = join.sessionRegionData?.regionName
    if (region) options.nethernet._signallingHost = `signal-${String(region).toLowerCase()}.franchise.minecraft-services.net`
  } else {
    const address = join.address?.match(/^(.*):(\d+)$/)
    if (!address) throw new Error('Invalid RakNet Realm address')
    options.transport = 'raknet'
    options.host = address[1].replace(/^\[|\]$/g, '')
    options.port = Number(address[2])
    delete options.nethernet
  }
}

/**
 * Authenticates to Minecraft via device code based Microsoft auth,
 * then connects to the specified server in Client Options
 *
 * @function
 * @param {object} client - The client passed to protocol
 * @param {object} options - Client Options
 */
async function authenticate (client, options) {
  validateOptions(options)
  try {
    options.authflow ??= new PrismarineAuth(options.username, options.profilesFolder, options, options.onMsaCode)
    const loginData = await options.authflow.getMinecraftBedrockToken(client.clientX509).catch(e => {
      if (options.password) console.warn('Sign in failed, try removing the password field')
      throw e
    })
    const chains = loginData.chain

    debug('loginData', { chainLength: chains.length, hasToken: Boolean(loginData.token) })

    // First chain is Mojang stuff, second is Xbox profile data used by mc
    const jwt = chains[1]
    const [header, payload, signature] = jwt.split('.').map(k => Buffer.from(k, 'base64')) // eslint-disable-line
    const xboxProfile = JSON.parse(String(payload))

    debug('got xbox profile', xboxProfile)

    const profile = {
      name: xboxProfile?.extraData?.displayName || 'Player',
      uuid: xboxProfile?.extraData?.identity || 'adfcf5ca-206c-404a-aec4-f59fff264c9b', // random
      xuid: xboxProfile?.extraData?.XUID || 0
    }

    return postAuthenticate(client, profile, loginData)
  } catch (err) {
    client.onConnectionError(err)
  }
}

/**
 * Creates an offline session for the client
 */
function createOfflineSession (client, options) {
  validateOptions(options)
  if (!options.username) throw Error('Must specify a valid username')
  const profile = {
    name: options.username,
    uuid: uuidFrom(options.username), // random
    xuid: 0
  }
  return postAuthenticate(client, profile, { chain: [], token: '' }) // No extra JWTs, only send our own login data
}

function postAuthenticate (client, profile, auth = {}) {
  if (client._closed) return
  client.profile = profile
  client.username = profile.name
  client.accessToken = auth.chain || []
  client.multiplayerToken = auth.token || ''
  client.emit('session', profile)
}

module.exports = {
  createOfflineSession,
  authenticate,
  realmAuthenticate,
  worldAuthenticate,
  serverAuthenticate
}
