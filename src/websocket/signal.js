const { WebSocket } = require('ws')
const { randomUUID } = require('crypto')
const { stringify } = require('json-bigint')
const { once, EventEmitter } = require('node:events')
const { SignalStructure } = require('node-nethernet')

const debug = require('debug')('minecraft-protocol')

const LegacyMessageType = {
  RequestPing: 0,
  Signal: 1,
  Credentials: 2
}

class NethernetSignal extends EventEmitter {
  constructor (networkId, authflow, version, options = {}) {
    super()

    this.networkId = networkId
    this.authflow = authflow
    this.version = version
    this.host = options.host || null

    this._protocol = options.protocol || 'legacy'
    this._triedJsonRpc = this._protocol === 'jsonrpc'

    this.ws = null
    this.credentials = null
    this.pingInterval = null
    this.retryCount = 0
    this._pendingRequests = new Map()
  }

  async connect () {
    if (this.ws?.readyState === WebSocket.OPEN) throw new Error('Already connected signaling server')
    await this.init()
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

      if (this.ws.readyState === WebSocket.OPEN) {
        await new Promise(resolve => {
          this.ws.onclose = resolve
          this.ws.close(1000, 'Normal Closure')
        })
      }

      this.ws.onerror = null
    }

    if (resume) return this.init()
  }

  async init () {
    const xbl = await this.authflow.getMinecraftBedrockServicesToken({ version: this.version })

    debug('Fetched XBL Token', xbl)

    const signalHost = this.host || 'signal.franchise.minecraft-services.net'

    let address, headers
    if (this._protocol === 'jsonrpc') {
      address = `wss://${signalHost}/ws/v1.0/messaging/connect`
      headers = { Authorization: xbl.mcToken, 'session-id': randomUUID(), 'request-id': randomUUID() }
    } else {
      address = `wss://${signalHost}/ws/v1.0/signaling/${this.networkId}`
      headers = { Authorization: xbl.mcToken, 'session-id': String(this.networkId), 'request-id': Date.now().toString() }
    }

    debug('Connecting to Signal', address)

    const ws = new WebSocket(address, { headers })
    ws.onopen = () => this.onOpen()
    ws.onclose = (event) => this.onClose(event.code, event.reason)
    ws.onerror = (event) => this.onError(event)
    ws.onmessage = (event) => this.onMessage(event.data)
    this.ws = ws
  }

  onOpen () {
    debug('Connected to Signal')

    if (this._protocol === 'jsonrpc') {
      this._requestTurnAuth().catch(err => {
        debug('TURN auth request failed', err)
        this.emit('error', err)
      })

      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(stringify({ jsonrpc: '2.0', id: randomUUID(), method: 'System_Ping_v1_0', params: [] }))
        }
      }, 5000)
    } else {
      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ Type: LegacyMessageType.RequestPing }))
        }
      }, 5000)
    }
  }

  async _requestTurnAuth () {
    const result = await this._request('Signaling_TurnAuth_v1_0', {})
    this.credentials = parseTurnAuth(result)
    this.emit('credentials', this.credentials)
  }

  _request (method, params) {
    const id = randomUUID()
    this.ws.send(stringify({ jsonrpc: '2.0', id, method, params }))

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingRequests.delete(id)
        reject(new Error(`${method} timed out`))
      }, 15000)

      this._pendingRequests.set(id, {
        resolve (value) { clearTimeout(timeout); resolve(value) },
        reject (error) { clearTimeout(timeout); reject(error) }
      })
    })
  }

  onError (err) {
    debug('Signal Error', err)
  }

  onClose (code, reason) {
    debug(`Signal Disconnected with code ${code} and reason ${reason}`)

    if (!this.credentials && !this._triedJsonRpc) {
      debug('Failed legacy connection, trying JSONRPC protocol')
      this._triedJsonRpc = true
      this._protocol = 'jsonrpc'
      this.destroy(true)
      return
    }

    if (code === 1006) {
      debug('Signal Connection Closed Unexpectedly')

      if (this.retryCount < 5) {
        this.retryCount++
        this.destroy(true)
      } else {
        this.destroy()
        throw new Error('Signal Connection Closed Unexpectedly')
      }
    }
  }

  onMessage (res) {
    if (typeof res !== 'string') return debug('Received non-string message', res)

    const message = JSON.parse(res)

    debug('Recieved message', message)

    if (message.jsonrpc) {
      this._onJsonRpcMessage(message)
      return
    }

    switch (message.Type) {
      case LegacyMessageType.Credentials: {
        if (message.From !== 'Server') {
          debug('Received credentials from non-Server', 'message', message)
          return
        }
        this.credentials = parseTurnServers(message.Message)
        this.emit('credentials', this.credentials)
        break
      }
      case LegacyMessageType.Signal: {
        const signal = parseSignalMessage(message.Message)
        if (!signal) {
          debug('Could not parse signal', message.Message)
          return
        }
        signal.networkId = message.From
        this.emit('signal', signal)
        break
      }
      case LegacyMessageType.RequestPing: {
        if (message.Message) {
          try {
            const error = JSON.parse(message.Message)
            debug('Signal message error', error)
            this.emit('messageError', error)
          } catch {
            debug('Signal Pinged', message.Message)
          }
        } else {
          debug('Signal Pinged')
        }
        break
      }
    }
  }

  _onJsonRpcMessage (message) {
    // Resolve pending request/response pairs
    if (message.id !== undefined && this._pendingRequests.has(message.id)) {
      const pending = this._pendingRequests.get(message.id)
      this._pendingRequests.delete(message.id)
      if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)))
      else pending.resolve(message.result)
      return
    }

    // Incoming signal delivery
    if (message.method === 'Signaling_ReceiveMessage_v1_0') {
      const items = Array.isArray(message.params) ? message.params : [message.params]
      for (const item of items) {
        const signal = parseJsonRpcReceiveItem(item)
        if (signal) this.emit('signal', signal)
      }
      if (message.id !== undefined) {
        this.ws.send(stringify({ jsonrpc: '2.0', id: message.id, result: null }))
      }
      return
    }

    if (message.method === 'System_Pong_v1_0' || message.method === 'Signaling_DeliveryNotification_V1_0') {
      if (message.id !== undefined) {
        this.ws.send(stringify({ jsonrpc: '2.0', id: message.id, result: null }))
      }
      return
    }

    debug('Unhandled JSON-RPC message', message.method || message.id)
  }

  write (signal) {
    if (!this.ws) throw new Error('WebSocket not connected')

    let message
    if (this._protocol === 'jsonrpc') {
      const innerMessage = JSON.stringify({
        jsonrpc: '2.0',
        method: 'Signaling_WebRtc_v1_0',
        params: { netherNetId: String(this.networkId), message: signal.toString() }
      })
      message = stringify({
        jsonrpc: '2.0',
        id: randomUUID(),
        method: 'Signaling_SendClientMessage_v1_0',
        params: {
          toPlayerId: String(signal.networkId),
          messageId: randomUUID(),
          message: innerMessage
        }
      })
    } else {
      message = stringify({ Type: LegacyMessageType.Signal, To: signal.networkId, Message: signal.toString() })
    }

    debug('Sending Signal', message)

    this.ws.send(message)
  }
}

module.exports = { NethernetSignal }

function parseTurnServers (dataString) {
  const data = JSON.parse(dataString)
  return parseTurnAuth(data)
}

function parseTurnAuth (data) {
  return data.TurnAuthServers.map(server => ({
    urls: server.Urls,
    username: server.Username,
    credential: server.Password
  }))
}

function parseSignalMessage (message) {
  if (typeof message !== 'string') return null

  try {
    const parsed = JSON.parse(message)
    const signal = parseJsonRpcSignal(parsed)
    if (signal) return signal
  } catch {}

  try {
    return SignalStructure.fromString(message)
  } catch {
    return null
  }
}

function parseJsonRpcSignal (message) {
  const params = message?.params || message?.result
  if (!params || typeof params !== 'object') return null

  const signalText = params.message || params.Message || params.innerMessage
  if (!signalText) return null

  try {
    const signal = SignalStructure.fromString(signalText)
    const networkId = params.netherNetId || params.NetherNetId || params.fromNetherNetId || params.fromPlayerId
    if (networkId) signal.networkId = String(networkId)
    return signal
  } catch {
    return null
  }
}

function parseJsonRpcReceiveItem (item) {
  if (!item || typeof item !== 'object') return null

  const message = item.Message || item.message
  if (!message) return null

  const signal = parseSignalMessage(message)
  if (!signal) return null

  const networkId = item.From || item.from || item.fromPlayerId || signal.networkId
  if (networkId) signal.networkId = String(networkId)

  return signal
}
