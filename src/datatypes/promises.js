module.exports = {
  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  waitFor (cb, withTimeout) {
    return Promise.race([
      new Promise((res, rej) => cb(res)),
      sleep(withTimeout)
    ])
  }
}
