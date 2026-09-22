const waitForPong = require('../client/ping')
const { Client, Server } = require('nethernet')
const { NethernetServerAdvertisement } = require('./advertisement')
const debug = require('debug')('bedrock-protocol:nethernet')

class NethernetClient {
  constructor (options = {}) {
    this.discoverAny = options.networkId == null
    this.discoveryAbort = new AbortController()
    this.onConnected = () => { }
    this.onCloseConnection = () => { }
    this.onEncapsulated = () => { }
    this.onError = () => { }

    this.nethernet = new Client(
      options.networkId ?? 0n,
      options.host || '255.255.255.255',
      { webrtcBackend: options.webrtcBackend }
    )

    this.nethernet.on('connected', (client) => {
      this.onConnected(client)
    })

    this.nethernet.on('error', error => this.onError(error))

    this.nethernet.on('disconnect', (address, reason) => {
      this.onCloseConnection(reason ?? address)
    })

    this.nethernet.on('encapsulated', (data, address) => {
      this.onEncapsulated({ buffer: data }, address)
    })
  }

  async connect () {
    await this.nethernet.connect()
  }

  sendReliable (data) {
    this.nethernet.send(data)
  }

  ping (timeout = 10000, { signal } = {}) {
    signal = signal ? AbortSignal.any([signal, this.discoveryAbort.signal]) : this.discoveryAbort.signal
    return waitForPong(this.nethernet, timeout, signal, ret => {
      if (!this.discoverAny && String(ret.sender_id) !== String(this.nethernet.serverNetworkId)) return
      try {
        const ad = NethernetServerAdvertisement.fromBuffer(Buffer.from(ret.data, 'hex'))
        ad.networkId = BigInt(ret.sender_id.toString())
        return ad
      } catch (error) {
        debug('Ignoring unreadable discovery advertisement: %s', error.message)
      }
    })
  }

  close () {
    if (this.discoveryAbort.signal.aborted) return
    this.discoveryAbort.abort(new Error('Nethernet discovery cancelled'))
    this.nethernet.close()
  }
}

class NethernetServer {
  constructor (options = {}, server) {
    this.onOpenConnection = () => { }
    this.onCloseConnection = () => { }
    this.onEncapsulated = () => { }
    this.onError = () => { }
    this.onClose = () => { }
    this.updateAdvertisement = () => {
      this.nethernet.setAdvertisement(server.getAdvertisement().toBuffer())
    }

    this.nethernet = new Server({ ...options })
    this.nethernet.on('error', error => this.onError(error))

    this.nethernet.on('openConnection', (client) => {
      client.sendReliable = function (buffer) {
        return this.send(buffer)
      }
      this.onOpenConnection(client)
    })

    this.nethernet.on('closeConnection', (address, reason) => {
      this.onCloseConnection({ address }, reason)
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
