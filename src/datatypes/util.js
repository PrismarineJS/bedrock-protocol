module.exports = {
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  waitFor(cb, withTimeout) {
    return Promise.race([
      new Promise((res, rej) => cb(res)),
      sleep(withTimeout)
    ])
  },

  serialize(obj = {}, fmt) {
    return JSON.stringify(obj, (k, v) => typeof v == 'bigint' ? v.toString() : v, fmt)
  }
}