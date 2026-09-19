const LoginPhase = Object.freeze({
  AwaitingLogin: 'awaiting_login',
  VerifyingLogin: 'verifying_login',
  AwaitingClientHandshake: 'awaiting_client_handshake',
  Complete: 'complete',
  Rejected: 'rejected',
  Closed: 'closed'
})

const transitions = {
  [LoginPhase.AwaitingLogin]: new Set([LoginPhase.VerifyingLogin, LoginPhase.Rejected, LoginPhase.Closed]),
  [LoginPhase.VerifyingLogin]: new Set([LoginPhase.AwaitingClientHandshake, LoginPhase.Rejected, LoginPhase.Closed]),
  [LoginPhase.AwaitingClientHandshake]: new Set([LoginPhase.Complete, LoginPhase.Rejected, LoginPhase.Closed]),
  [LoginPhase.Complete]: new Set([LoginPhase.Rejected, LoginPhase.Closed]),
  [LoginPhase.Rejected]: new Set([LoginPhase.Closed]),
  [LoginPhase.Closed]: new Set()
}

class ProtocolStateError extends Error {
  constructor (current, expected) {
    super(`Login packet is not allowed during ${current}; expected ${expected}`)
    this.name = 'ProtocolStateError'
  }
}

class LoginState {
  #phase = LoginPhase.AwaitingLogin

  get phase () {
    return this.#phase
  }

  is (phase) {
    return this.#phase === phase
  }

  require (phase) {
    if (!this.is(phase)) throw new ProtocolStateError(this.#phase, phase)
  }

  transition (next) {
    if (!transitions[this.#phase].has(next)) throw new ProtocolStateError(this.#phase, next)
    this.#phase = next
  }

  reject () {
    if (this.is(LoginPhase.Rejected) || this.is(LoginPhase.Closed)) return false
    this.transition(LoginPhase.Rejected)
    return true
  }

  close () {
    if (!this.is(LoginPhase.Closed)) this.transition(LoginPhase.Closed)
  }
}

module.exports = { LoginPhase, LoginState, ProtocolStateError }
