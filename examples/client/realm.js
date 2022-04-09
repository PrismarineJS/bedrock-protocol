/* eslint-disable */
const bedrock = require('bedrock-protocol')
const client = bedrock.createClient({
  realms: {
    // realmId: '1234567', // Connect the client to a Realm using the Realms ID
    // realmInvite: 'https://realms.gg/AB1CD2EFA3B', // Connect the client to a Realm using the Realms invite URL or code
    pickRealm: (realms) => realms.find(e => e.name === 'Realm Name') // Connect the client to a Realm using a function that returns a Realm
  }
})

client.on('text', (packet) => { // Listen for chat messages
    console.log('Received Text:', packet)
})
