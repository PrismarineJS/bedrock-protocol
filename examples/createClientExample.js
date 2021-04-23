const { createClient } = require('bedrock-protocol')

const client = createClient({ host: '127.0.0.1' })

let ix = 0
client.on('packet', (args) => {
  console.log(`Packet ${ix} recieved`)
  ix++
})
