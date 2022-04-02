/* eslint-disable */
const bedrock = require('bedrock-protocol')
const client = bedrock.createClient({
  realms: {
    // realmId: '1234567',
    // realmInvite: 'https://realms.gg/AB1CD2EFA3B',
    pickRealm: (realms) => realms.find(e => e.name === 'Realm Name')
  }
})

client.on('text', (packet) => { // Listen for chat messages
    console.log('Received Text:', packet)
})
