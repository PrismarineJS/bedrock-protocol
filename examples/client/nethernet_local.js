process.env.DEBUG = 'minecraft-protocol'

const { Client } = require('node-nethernet')
const { createClient } = require('bedrock-protocol')

const c = new Client()

c.once('pong', (pong) => {
  c.close()

  const client = createClient({
    transport: 'nethernet', // Use the Nethernet transport
    networkId: pong.senderId,
    useSignalling: false
  })

  let ix = 0
  client.on('packet', (args) => {
    console.log(`Packet ${ix} recieved`)
    ix++
  })
})
