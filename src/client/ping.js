const { on } = require('events')

// Subscribe before sending; ignore replies the transport cannot decode.
module.exports = async function waitForPong (socket, timeout, signal, read) {
  const controller = new AbortController()
  signal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  signal.throwIfAborted()
  const replies = on(socket, 'pong', { signal })
  const timer = setTimeout(() => controller.abort(new DOMException('Ping timed out', 'TimeoutError')), timeout)
  try {
    socket.ping()
    for await (const [packet] of replies) {
      signal.throwIfAborted()
      const result = read(packet)
      if (result !== undefined) return result
    }
  } catch (error) {
    throw signal.aborted ? signal.reason : error
  } finally {
    clearTimeout(timer)
    await replies.return()
  }
}
