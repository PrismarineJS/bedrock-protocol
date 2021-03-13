const { MsAuthFlow } = require('./authFlow.js')

/**
 * Obtains Minecaft profile data using a Minecraft access token and starts the join sequence
 * @param {object} client - The client passed to protocol
 * @param {object} options - Client Options
 * @param {string} chains - Minecraft JWTs to send to server
 */
async function postAuthenticate (client, options, chains) {
  // First chain is Mojang stuff, second is Xbox profile data used by mc
  const jwt = chains[1]
  const [header, payload, signature] = jwt.split('.').map(k => Buffer.from(k, 'base64')) // eslint-disable-line
  const xboxProfile = JSON.parse(String(payload))

  // This profile / session here could be simplified down to where it just passes the uuid of the player to encrypt.js
  // That way you could remove some lines of code. It accesses client.session.selectedProfile.id so /shrug.
  // - Kashalls
  const profile = {
    name: xboxProfile?.extraData?.displayName || 'Player',
    uuid: xboxProfile?.extraData?.identity || 'adfcf5ca-206c-404a-aec4-f59fff264c9b', // random
    xuid: xboxProfile?.extraData?.XUID || 0
  }

  client.profile = profile
  client.username = profile.name
  client.accessToken = chains
  client.emit('session', profile)
}

/**
 * Authenticates with Mincrosoft through user credentials, then
 * with Xbox Live, Minecraft, checks entitlements and returns profile
 *
 * @function
 * @param {object} client - The client passed to protocol
 * @param {object} options - Client Options
 */
async function authenticatePassword (client, options) {
  throw Error('Not implemented')
}

/**
 * Authenticates to Minecraft via device code based Microsoft auth,
 * then connects to the specified server in Client Options
 *
 * @function
 * @param {object} client - The client passed to protocol
 * @param {object} options - Client Options
 */
async function authenticateDeviceCode (client, options) {
  try {
    const flow = new MsAuthFlow(options.username, options.profilesFolder, options.onMsaCode)

    const chain = await flow.getMinecraftToken(client.clientX509)
    // console.log('Chain', chain)
    await postAuthenticate(client, options, chain)
  } catch (err) {
    console.error(err)
    client.emit('error', err)
  }
}

module.exports = {
  authenticatePassword,
  authenticateDeviceCode
}

// async function msaTest () {
//   // MsAuthFlow.resetTokenCaches()

//   await authenticateDeviceCode({
//     connect(...args) {
//       console.log('Connecting', args)
//     },
//     emit(...e) {
//       console.log('Event', e)
//     }
//   }, {})
// }

// // debug with node microsoftAuth.js
// if (!module.parent) {
//   msaTest()
// }
