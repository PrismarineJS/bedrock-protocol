const { WebSocket } = require('ws')
const { stringify } = require('json-bigint')
const { once, EventEmitter } = require('node:events')
const { SignalStructure } = require('../nethernet/signalling')

const debug = require('debug')('minecraft-protocol')

const MessageType = {
  RequestPing: 0,
  Signal: 1,
  Credentials: 2
}

class NethernetSignal extends EventEmitter {
  constructor (networkId, authflow) {
    super()

    this.networkId = networkId

    this.authflow = authflow

    this.ws = null

    this.pingInterval = null

    this.credentials = null
  }

  async connect (version) {
    if (this.ws?.readyState === WebSocket.OPEN) throw new Error('Already connected signalling server')
    await this.init(version)

    await once(this, 'credentials')
  }

  async destroy (resume = false) {
    debug('Disconnecting from Signal')

    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    if (this.ws) {
      this.ws.onmessage = null
      this.ws.onclose = null

      const shouldClose = this.ws.readyState === WebSocket.OPEN

      if (shouldClose) {
        let outerResolve

        const promise = new Promise((resolve) => {
          outerResolve = resolve
        })

        this.ws.onclose = outerResolve

        this.ws.close(1000, 'Normal Closure')

        await promise
      }

      this.ws.onerror = null
    }

    if (resume) {
      return this.init()
    }
  }

  async init (version) {
    const xbl = await this.authflow.getMinecraftBedrockServicesToken({ version })

    const address = `wss://signal.franchise.minecraft-services.net/ws/v1.0/signaling/${this.networkId}`

    debug('Connecting to Signal', address)

    const ws = new WebSocket(address, {
      headers: { Authorization: xbl.mcToken }
    })

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ Type: MessageType.RequestPing }))
      }
    })

    ws.onopen = () => {
      this.onOpen()
    }

    ws.onclose = (event) => {
      this.onClose(event.code, event.reason)
    }

    ws.onerror = (event) => {
      this.onError(event)
    }

    ws.onmessage = (event) => {
      this.onMessage(event.data)
    }

    this.ws = ws
  }

  onOpen () {
    debug('Connected to Signal')
  }

  onError (err) {
    debug('Signal Error', err)
  }

  onClose (code, reason) {
    debug(`Signal Disconnected with code ${code} and reason ${reason}`)

    if (code === 1006) {
      debug('Signal Connection Closed Unexpectedly')

      this.destroy(true)
    }
  }

  onMessage (res) {
    if (!(typeof res === 'string')) return debug('Received non-string message', res)

    const message = JSON.parse(res)

    debug('Recieved message', message)

    switch (message.Type) {
      case MessageType.Credentials: {
        if (message.From !== 'Server') {
          debug('Received credentials from non-Server', 'message', message)
          return
        }

        this.credentials = JSON.parse(message.Message).TurnAuthServers.map(credential => {
          return {
            urls: credential.Urls.join(','),
            credential: credential.Password,
            username: credential.Username
          }
        })

        this.emit('credentials', this.credentials)

        break
      }
      case MessageType.Signal: {
        const signal = SignalStructure.fromString(message.Message)

        signal.networkId = message.From

        this.emit('signal', signal)
        break
      }
      case MessageType.RequestPing: {
        debug('Signal Pinged')
      }
    }
  }

  write (signal) {
    if (!this.ws) throw new Error('WebSocket not connected')

    const message = stringify({ Type: MessageType.Signal, To: signal.networkId, Message: signal.toString() })

    debug('Sending Signal', message)

    this.ws.send(message)
  }
}

module.exports = { NethernetSignal }
