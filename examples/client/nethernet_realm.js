process.env.DEBUG = 'minecraft-protocol'

const { createClient } = require('bedrock-protocol')

const client = createClient({
  // The join response selects RakNet or Nethernet automatically.
  realms: { realmId: process.argv[2] } // node nethernet_realm.js <realm-id>
})

client.on('text', (packet) => { // Listen for chat messages and echo them back.
  if (packet.source_name !== client.username) {
    client.queue('text', {
      type: 'chat',
      needs_translation: false,
      source_name: client.username,
      xuid: '',
      platform_chat_id: '',
      filtered_message: '',
      message: `${packet.source_name} said: ${packet.message} on ${new Date().toLocaleString()}`
    })
  }
})
