const difference = (o1, o2) => Object.keys(o2).reduce((diff, key) => {
  if (o1[key] === o2[key]) return diff
  return {
    ...diff,
    [key]: o2[key]
  }
}, {})

const diff = (o1, o2) => { const dif = difference(o1, o2); return Object.keys(dif).length ? dif : null }

const d2r = deg => (180 - (deg < 0 ? (360 + deg) : deg)) * (Math.PI / 180)
const r2d = rad => {
  let deg = rad * (180 / Math.PI)
  deg = deg % 360
  return 180 - deg
}

module.exports = {
  diff,
  d2r,
  r2d
}
