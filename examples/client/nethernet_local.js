process.env.DEBUG = 'minecraft-protocol'

const { Client } = require('nethernet')
const { createClient } = require('bedrock-protocol')

const c = new Client(0n)
c.on('error', error => {
  c.close()
  console.error(error)
})

c.once('pong', (pong) => {
  c.close()

  const client = createClient({
    transport: 'nethernet', // Use the Nethernet transport
    nethernet: { networkId: pong.sender_id, signalling: 'lan' }
  })
  client.on('error', console.error)

  let ix = 0
  client.on('packet', (args) => {
    console.log(`Packet ${ix} received`)
    ix++
  })
})
