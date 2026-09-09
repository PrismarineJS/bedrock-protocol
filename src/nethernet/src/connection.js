const MAX_MESSAGE_SIZE = 50000; // 262143 IS MAX MESSAGE SIZE EXACT, lower because of larger packets

const ensureBuffer = (data) => {
  if (Buffer.isBuffer(data)) return data
  if (typeof data === 'string') return Buffer.from(data)
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength)

  throw new Error('Unsupported data type for RTC message')
}

class Connection {
  constructor(nethernet, address, rtcConnection) {
    this.nethernet = nethernet
    this.address = address
    this.rtcConnection = rtcConnection
    this.reliable = null
    this.unreliable = null
    this.promisedSegments = 0
    this.buf = Buffer.allocUnsafe(0)
    this.sendQueue = []
  }

  setChannels(reliable, unreliable) {
    if (reliable) {
      this.reliable = reliable
      this.reliable.binaryType = 'arraybuffer'
      this.reliable.onmessage = (event) => this.handleMessage(event.data)
      this.reliable.onopen = () => this.flushQueue()
      this.reliable.onclose = () => {
        this.sendQueue.length = 0
        this.nethernet.emit('disconnect', this.address, 'reliable_channel_closed')
      }
    }

    if (unreliable) {
      this.unreliable = unreliable
      this.unreliable.binaryType = 'arraybuffer'
    }
  }

  handleMessage(data) {
    data = ensureBuffer(data)

    if (data.length < 2) throw new Error('Unexpected EOF')

    const segments = data[0]
    data = data.subarray(1)

    if (this.promisedSegments > 0 && this.promisedSegments - 1 !== segments) throw new Error(`Invalid promised segments: expected ${this.promisedSegments - 1}, got ${segments}`)

    this.promisedSegments = segments
    this.buf = this.buf ? Buffer.concat([this.buf, data]) : data

    if (this.promisedSegments > 0) return

    this.nethernet.emit('encapsulated', this.buf)
    this.buf = null;
  }

  send(data) {
    const payload = ensureBuffer(data)

    if (!this.reliable || this.reliable.readyState === 'connecting') {
      this.sendQueue.push(payload)
      return 0
    }

    // The connection is already gone (closed by the remote side, a failed
    // ICE/DTLS negotiation, etc). This is an expected end state once
    // disconnected, not a bug the caller should have to try/catch on every
    // send — drop the payload and rely on the 'disconnect' event (fired by
    // onclose above, and by onconnectionstatechange) to tell the consumer
    // the connection is dead so it can stop calling send() at all.
    if (this.reliable.readyState === 'closed' || this.reliable.readyState === 'closing') return 0

    return this.sendNow(payload)
  }

  sendNow(data) {
    const segments = Math.ceil(data.length / MAX_MESSAGE_SIZE)
    const buffers = Array(segments)

    for (let i = 0; i < segments; i++) {
      buffers[i] = data.slice(i * MAX_MESSAGE_SIZE, Math.min((i + 1) * MAX_MESSAGE_SIZE, data.length))
    }

    for (let i = 0; i < buffers.length; i++) {
      const message = Buffer.allocUnsafe(1 + buffers[i].length)
      message[0] = segments - 1 - i
      buffers[i].copy(message, 1)
      this.reliable?.send(message)
    }

    return data.length
  }

  flushQueue() {
    for (let i = 0; i < this.sendQueue.length; i++) {
      this.sendNow(this.sendQueue[i])
    }
  }

  close() {
    this.reliable?.close()
    this.unreliable?.close()
    this.rtcConnection?.close()
  }
}

module.exports = { Connection }