const { Client } = require('./nethernet/index')

class NethernetClient {
  constructor(options = {}) {
    this.connected = false
    this.onConnected = () => {}
    this.onCloseConnection = () => {}
    this.onEncapsulated = () => {}

    this.nethernet = new Client(options.networkId, "255.255.255.255", options.token, options.privateKey)

    this.nethernet.on('connected', (client) => {
      if (this.connected) return

      this.onConnected(client)
      this.connected = true
    });

    this.nethernet.on('disconnect', (_id, reason) => {
      this.onCloseConnection(reason)
      this.connected = false
    });

    this.nethernet.on('encapsulated', (buffer) => {
      this.onEncapsulated({ buffer })
    });
  }

  async connect() {
    await this.nethernet.connect()
  }

  sendReliable(data) {
    this.nethernet.send(data)
  }

  set credentials(value) {
    this.nethernet.credentials = value
  }

  get credentials() {
    return this.nethernet.credentials
  }

  set signalHandler(handler) {
    this.nethernet.signalHandler = handler
  }

  handleSignal(signal) {
    this.nethernet.handleSignal(signal)
  }

  close() {
    this.connected = false
    this.nethernet.close()
  }
}

module.exports = { NethernetClient }