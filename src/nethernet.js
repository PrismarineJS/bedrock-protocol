const { waitFor } = require('./datatypes/util')
const { Client } = require('./nethernet/client')
const { Server } = require('./nethernet/server')

class NethernetClient {
  constructor (options = {}) {
    this.onConnected = () => { }
    this.onCloseConnection = () => { }
    this.onEncapsulated = () => { }

    this.nethernet = new Client({ ...options })

    this.nethernet.on('connected', (client) => {
      this.onConnected(client)
    })

    this.nethernet.on('disconnect', (reason) => {
      this.onCloseConnection(reason)
    })

    this.nethernet.on('encapsulated', (data, address) => {
      this.onEncapsulated({ buffer: data }, address)
    })
  }

  async connect () {
    await this.nethernet.connect()
  }

  sendReliable (data) {
    this.nethernet.connection.sendReliable(data)
  }

  async ping (timeout = 10000) {
    return waitFor((done) => {
      this.nethernet.ping().then(data => { done(data) })
    }, timeout, () => {
      throw new Error('Ping timed out')
    })
  }

  close () {
    this.nethernet.close()
  }
}

class NethernetServer {
  constructor (options = {}, server) {
    this.onOpenConnection = () => { }
    this.onCloseConnection = () => { }
    this.onEncapsulated = () => { }
    this.onClose = () => {}
    this.updateAdvertisement = () => {
      this.nethernet.setAdvertisement(server.getAdvertisement().toBuffer())
    }

    this.nethernet = new Server({ ...options })

    this.nethernet.on('openConnection', (client) => {
      this.onOpenConnection(client)
    })

    this.nethernet.on('closeConnection', (address, reason) => {
      this.onCloseConnection(address, reason)
    })

    this.nethernet.on('encapsulated', (data, address) => {
      this.onEncapsulated(data, address)
    })
  }

  async listen () {
    await this.nethernet.listen()
  }

  close () {
    this.nethernet.close()
  }
}

module.exports = { NethernetClient, NethernetServer }