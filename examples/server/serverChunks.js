// CHUNKS
const { WorldProvider } = require('bedrock-provider')
const { LevelDB } = require('leveldb-zlib')
const { join } = require('path')

async function loadWorld (version) {
  const path = join(__dirname, `../../tools/bds-${version}/worlds/Bedrock level/db`)
  console.log('Loading world at path', path) // Load world from testing server
  const db = new LevelDB(path, { createIfMissing: false })
  await db.open()
  const wp = new WorldProvider(db, { dimension: 0 })

  async function requestChunks (x, z, radius) {
    const chunks = []
    const cxStart = (x >> 4) - radius
    const cxEnd = (x >> 4) + radius
    const czStart = (z >> 4) - radius
    const czEnd = (z >> 4) + radius

    for (let cx = cxStart; cx < cxEnd; cx++) {
      for (let cz = czStart; cz < czEnd; cz++) {
        const cc = await wp.load(cx, cz, true)
        if (!cc) {
          continue
        }
        const cbuf = await cc.networkEncodeNoCache()
        chunks.push({
          x: cx,
          z: cz,
          sub_chunk_count: cc.sectionsLen,
          cache_enabled: false,
          blobs: [],
          payload: cbuf
        })
      }
    }

    return chunks
  }

  return { requestChunks }
}

module.exports = { loadWorld }
