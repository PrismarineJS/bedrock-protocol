const debug = require('debug')('minecraft-protocol')

const MAX_MESSAGE_SIZE = 10_000

class Connection {
  constructor (nethernet, address, rtcConnection) {
    this.nethernet = nethernet

    this.address = address

    this.rtcConnection = rtcConnection

    this.reliable = null

    this.unreliable = null

    this.promisedSegments = 0

    this.buf = Buffer.alloc(0)
  }

  setChannels (reliable, unreliable) {
    if (reliable) {
      this.reliable = reliable
      this.reliable.onmessage = (msg) => this.handleMessage(msg.data)
    }
    if (unreliable) {
      this.unreliable = unreliable
    }
  }

  handleMessage (data) {
    if (typeof data === 'string') {
      data = Buffer.from(data)
    }

    if (data.length < 2) {
      throw new Error('Unexpected EOF')
    }

    const segments = data[0]

    debug(`handleMessage segments: ${segments}`)

    data = data.subarray(1)

    if (this.promisedSegments > 0 && this.promisedSegments - 1 !== segments) {
      throw new Error(`Invalid promised segments: expected ${this.promisedSegments - 1}, got ${segments}`)
    }

    this.promisedSegments = segments

    this.buf = this.buf ? Buffer.concat([this.buf, data]) : data

    if (this.promisedSegments > 0) {
      return
    }

    this.nethernet.emit('encapsulated', this.buf, this.address)

    this.buf = null
  }

  sendReliable (data) {
    if (!this.reliable) {
      throw new Error('Reliable data channel is not available')
    }

    let n = 0

    if (typeof data === 'string') {
      data = Buffer.from(data)
    }

    let segments = Math.ceil(data.length / MAX_MESSAGE_SIZE)

    for (let i = 0; i < data.length; i += MAX_MESSAGE_SIZE) {
      segments--

      let end = i + MAX_MESSAGE_SIZE
      if (end > data.length) end = data.length

      const frag = data.subarray(i, end)
      const message = Buffer.concat([Buffer.from([segments]), frag])

      debug('Sending fragment', segments, 'header', message[0])

      this.reliable.send(message)

      n += frag.length
    }

    if (segments !== 0) {
      throw new Error('Segments count did not reach 0 after sending all fragments')
    }

    return n
  }

  close () {
    if (this.reliable) {
      this.reliable.close()
    }
    if (this.unreliable) {
      this.unreliable.close()
    }
    if (this.rtcConnection) {
      this.rtcConnection.close()
    }
  }
}

module.exports = { Connection }
