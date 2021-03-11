function test () {
  const chain = require('./sampleChain.json').chain

  let data = {}

  // There are three JWT tokens sent to us, one signed by the client
  // one signed by Mojang with the Mojang token we have and another one
  // from Xbox with addition user profile data
  // We verify that at least one of the tokens in the chain has been properly
  // signed by Mojang by checking the x509 public key in the JWT headers
  let didVerify = false

  let pubKey = mcPubKeyToPem(constants.PUBLIC_KEY_NEW)
  console.log(pubKey)
  for (const token of chain) {
    // const decoded = jwt.decode(token, pubKey, 'ES384')
    console.log('Decoding...', token)
    const decoded = JWT.verify(token, pubKey, { algorithms: 'ES384' })
    console.log('Decoded...')
    console.log('Decoded', decoded)

    // Check if signed by Mojang key
    const [header] = token.split('.')
    const hdec = Buffer.from(header, 'base64').toString('utf-8')
    const hjson = JSON.parse(hdec)
    if (hjson.x5u == constants.PUBLIC_KEY && !data.extraData?.XUID) {
      didVerify = true
      console.log('verified with mojang key!', hjson.x5u)
    }

    pubKey = mcPubKeyToPem(decoded.identityPublicKey)
    data = { ...data, ...decoded }
  }
  console.log('Result', data)
}

function test2 () {
  const chain = require('./login.json')
  const token = chain.data.clientData
  // console.log(token)

  const pubKey = mcPubKeyToPem(constants.CDATA_PUBLIC_KEY)

  const decoded = JWT.verify(token, pubKey, { algorithms: 'ES384' })

  // console.log('Decoded', decoded)

  fs.writeFileSync('clientData.json', JSON.stringify(decoded))
}
