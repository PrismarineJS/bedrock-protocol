const path = require('path')
const { Authflow: PrismarineAuth, Titles } = require('prismarine-auth')
const minecraftFolderPath = require('minecraft-folder-path')
const debug = require('debug')('minecraft-protocol')
const { uuidFrom } = require('../datatypes/util')
const { RealmAPI } = require('prismarine-realms')

function validateOptions (options) {
  if (!options.profilesFolder) {
    options.profilesFolder = path.join(minecraftFolderPath, 'nmp-cache')
  }
  if (options.authTitle === undefined) {
    options.authTitle = Titles.MinecraftNintendoSwitch
    options.deviceType = 'Nintendo'
    options.flow = 'live'
  }
}

async function realmAuthenticate (options) {
  validateOptions(options)

  options.authflow = new PrismarineAuth(options.username, options.profilesFolder, options, options.onMsaCode)

  const api = RealmAPI.from(options.authflow, 'bedrock')

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

  const { host, port } = await realm.getAddress()

  debug('realms connection', { host, port })

  options.host = host
  options.port = port
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
    const authflow = options.authflow || new PrismarineAuth(options.username, options.profilesFolder, options, options.onMsaCode)
    const chains = await authflow.getMinecraftBedrockToken(client.clientX509).catch(e => {
      if (options.password) console.warn('Sign in failed, try removing the password field')
      throw e
    })

    debug('chains', chains)

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

    return postAuthenticate(client, profile, chains)
  } catch (err) {
    console.error(err)
    client.emit('error', err)
  }
}

/**
 * Creates an offline session for the client
 */
function createOfflineSession (client, options) {
  if (!options.username) throw Error('Must specify a valid username')
  const profile = {
    name: options.username,
    uuid: uuidFrom(options.username), // random
    xuid: 0
  }
  return postAuthenticate(client, profile, []) // No extra JWTs, only send 1 client signed chain with all the data
}

function postAuthenticate (client, profile, chains) {
  client.profile = profile
  client.username = profile.name
  client.accessToken = chains
  client.emit('session', profile)
}

module.exports = {
  createOfflineSession,
  authenticate,
  realmAuthenticate
}
