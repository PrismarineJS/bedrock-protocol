const difference = (o1, o2) => Object.keys(o2).reduce((diff, key) => {
  if (o1[key] === o2[key]) return diff
  return {
    ...diff,
    [key]: o2[key]
  }
}, {})

const diff = (o1, o2) => { const dif = difference(o1, o2); return Object.keys(dif).length ? dif : null }

const d2r = deg => (180 - (deg < 0 ? (360 + deg) : deg)) * (Math.PI / 180)

module.exports = {
  diff,
  d2r
}
