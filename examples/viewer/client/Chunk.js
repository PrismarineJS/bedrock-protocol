const { ChunkColumn, Version } = require('bedrock-provider')
const { SubChunk } = require('bedrock-provider/js/SubChunk')
try { const v8 = require('v8') } catch { }

const Block = require('prismarine-block')('1.16.1')

class ChunkColumnWrapped extends ChunkColumn { // pchunk compatiblity wrapper
  // Block access
  setBlockStateId (pos, stateId) {
    super.setBlock(pos.x, pos.y, pos.z, Block.fromStateId(stateId))
  }

  getBlockStateId (pos) {
    return super.getBlock(pos.x, pos.y, pos.z)?.stateId
  }

  // // Serialization
  // serialize() {
  //   if (typeof v8 === 'undefined') {
  //     return JSON.stringify(this)
  //   } else {
  //     const copy = { ...this, sections: [] }
  //     for (const section of this.sections) {
  //       copy.sections.push(v8.serialize(section))
  //     }
  //     return v8.serialize(copy)
  //   }
  // }

  // toJson() { return this.serialize() }

  // static deserialize(obj) {
  //   if (typeof obj === 'string') {
  //     Oject.assign(this, JSON.parse(obj))
  //   } else { // Buffer
  //     const chunk = new ChunkColumnWrapped()
  //     const des = v8.deserialize(obj)
  //     Object.assign(chunk, des)
  //     chunk.sections = []
  //     for (const section of des.sections) {
  //       const s = new SubChunk()
  //       chunk.sections.push(Object.assign(s, v8.deserialize(section)))
  //     }
  //     // console.log('Des',obj,chunk)
  //     return chunk
  //   }
  // }

  // static fromJson(obj) {
  //   return ChunkColumnWrapped.deserialize(obj)
  // }
}

module.exports = (version) => {
  return ChunkColumnWrapped
}
