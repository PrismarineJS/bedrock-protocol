const { Client, Server } = require('nethernet')
const { NethernetServerAdvertisement } = require('./advertisement')
const debug = require('debug')('bedrock-protocol:nethernet')

class NethernetClient {
  constructor (options = {}) {
    this.closed = false
    this.pendingPings = new Set()
    this.onConnected = () => { }
    this.onCloseConnection = () => { }
    this.onEncapsulated = () => { }
    this.onError = () => { }

    this.nethernet = new Client(
      options.networkId,
      options.host || '255.255.255.255'
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
    if (this.closed) return Promise.reject(new Error('Nethernet client is closed'))
    if (signal?.aborted) return Promise.reject(signal.reason)
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (error, data) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.nethernet.removeListener('pong', onPong)
        this.nethernet.removeListener('error', onError)
        signal?.removeEventListener('abort', onAbort)
        this.pendingPings.delete(cancel)
        if (error) reject(error)
        else resolve(data)
      }
      const onPong = ret => {
        if (String(ret.sender_id) !== String(this.nethernet.serverNetworkId)) return
        let advertisement
        try {
          advertisement = NethernetServerAdvertisement.fromBuffer(Buffer.from(ret.data, 'hex'))
        } catch (error) {
          debug('Ignoring unreadable discovery advertisement: %s', error.message)
          return
        }
        finish(null, advertisement)
      }
      const onError = error => finish(error)
      const onAbort = () => finish(signal.reason)
      const cancel = () => finish(new Error('Nethernet discovery cancelled'))
      const timer = setTimeout(() => finish(new Error('Ping timed out')), timeout)
      this.pendingPings.add(cancel)
      this.nethernet.on('pong', onPong)
      this.nethernet.once('error', onError)
      signal?.addEventListener('abort', onAbort, { once: true })
      try {
        this.nethernet.ping()
      } catch (error) {
        finish(error)
      }
    })
  }

  close () {
    if (this.closed) return
    this.closed = true
    for (const cancel of this.pendingPings) cancel()
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
