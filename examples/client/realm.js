/* eslint-disable */
const bedrock = require('bedrock-protocol')

const options = {
  realms: {
    // realmId: '1234567', // Connect the client to a Realm using the Realms ID
    // realmInvite: 'https://realms.gg/AB1CD2EFA3B', // Connect the client to a Realm using the Realms invite URL or code
    pickRealm: (realms) => realms.find(e => e.name === 'Realm Name') // Connect the client to a Realm using a function that returns a Realm
  }
}

if (process.argv[3]) {
  Object.apply(options, bedrock.parseAddress(...process.argv.slice(2, 4)))
}

const client = bedrock.createClient(options)

client.on('text', (packet) => { // Listen for chat messages
    console.log('Received Text:', packet)
})
