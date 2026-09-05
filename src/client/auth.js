const { Authflow } = require('prismarine-auth')

async function authenticate(client, options) {
  try {
    options.authflow ??= new Authflow(options.username, options.profilesFolder, options, options.onMsaCode)

    const MCTOKEN = (await options.authflow.getMinecraftBedrockServicesToken({ version: client.options.version })).mcToken
    const body = JSON.stringify({ publicKey: client.clientX509 })

    const response = await fetch("https://authorization.franchise.minecraft-services.net/api/v1.0/multiplayer/session/start", {
      method: "POST",
      headers: {
        "accept": "*/*",
        "authorization": MCTOKEN,
        "content-type": "application/json",
        "User-Agent": "libhttpclient/1.0.0.0",
        "Accept-Language": "en-US",
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Length": body.length
      },
      body
    })

    const result = await response.json()

    if (result.code === "PlayerBanned") {
      throw new Error(JSON.stringify({
        "path": "/multiplayer/bedrock/authentication",
        "error": "FORBIDDEN"
      }))
    }

    const signedToken = result.result.signedToken

    const [h, payload] = signedToken.split('.').map(k => Buffer.from(k, 'base64'))
    
    client.tokenData = JSON.parse(String(payload))
    client.token = signedToken
    client.emit('session')
  } catch (err) {
    console.error(err)
    client.emit('error', err)
  }
}

module.exports = { authenticate }