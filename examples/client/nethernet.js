process.env.DEBUG = '*'

const readline = require('readline')
const { createClient } = require('bedrock-protocol')

async function pickSession (availableSessions) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    console.log('Available Sessions:')

    availableSessions.forEach((session, index) => console.log(`${index + 1}. ${session.customProperties.hostName} ${session.customProperties.worldName} (${session.customProperties.version})`))

    rl.question('Please select a session by number: ', (answer) => {
      const sessionIndex = parseInt(answer) - 1

      if (sessionIndex >= 0 && sessionIndex < availableSessions.length) {
        const selectedSession = availableSessions[sessionIndex]
        console.log(`You selected: ${selectedSession.customProperties.hostName} ${selectedSession.customProperties.worldName} (${selectedSession.customProperties.version})`)
        resolve(selectedSession)
      } else {
        console.log('Invalid selection. Please try again.')
        resolve(pickSession())
      }

      rl.close()
    })
  })
}

const client = createClient({
  transport: 'nethernet', // Use the Nethernet transport
  world: {
    pickSession
  }
})

let ix = 0
client.on('packet', (args) => {
  console.log(`Packet ${ix} recieved`)
  ix++
})
