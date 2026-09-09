'use strict'

// Apex MCBE — safe error emitter.
//
// Node's EventEmitter THROWS (ERR_UNHANDLED_ERROR -> "Unhandled error.")
// whenever an 'error' event is emitted while no 'error' listener is attached.
// This happens in two common situations in this bot:
//   1. A connection/auth step rejects AFTER the client was closed
//      (client.close() calls removeAllListeners(), so the listener is gone).
//   2. An 'error' is emitted before the consumer had a chance to attach a
//      listener (a race between createClient() and registerListeners()).
//
// Either case crashed the whole process. safeEmitError() never throws: it
// normalises the value into a real Error and only emits when a listener
// exists, otherwise it just logs a recoverable warning.
function toError(err) {
  if (err instanceof Error) return err
  const error = typeof err === 'string'
    ? new Error(err)
    : new Error(err && typeof err === 'object' && err.message ? String(err.message) : 'Unknown connection error')

  if (err && typeof err === 'object') {
    if (err.partialReadError === true) error.partialReadError = true
    if (err.code) error.code = err.code
  }

  return error
}

function isRecoverableProtocolError(error) {
  const msg = String(error?.message || error || '')
  return error?.partialReadError === true ||
    msg.includes('Read error for undefined') ||
    msg.includes('Missing characters in string') ||
    msg.includes('PartialReadError') ||
    msg.includes('Incomplete packet') ||
    msg.includes('Bad packet header') ||
    msg.includes('bad batch packet header') ||
    msg.includes('unexpected end of file')
}

function safeEmitError(emitter, err) {
  const error = toError(err)
  try {
    if (emitter && typeof emitter.listenerCount === 'function' && emitter.listenerCount('error') > 0) {
      emitter.emit('error', error)
    } else if (!isRecoverableProtocolError(error)) {
      console.warn('[Apex:protocol:recoverable] suppressed error with no listener:', error.message)
    }
  } catch (e) {
    // Last-resort guard so emitting an error can never take the bot down.
    console.warn('[Apex:protocol:recoverable] failed to emit error:', (e && e.message) || e)
  }
}

module.exports = { safeEmitError, toError, isRecoverableProtocolError }
