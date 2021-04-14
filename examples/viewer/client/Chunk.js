const { ChunkColumn } = require('bedrock-provider')

const Block = require('prismarine-block')('1.16.1')

class ChunkColumnWrapped extends ChunkColumn { // pchunk compatiblity wrapper
  // Block access
  setBlockStateId (pos, stateId) {
    super.setBlock(pos.x, pos.y, pos.z, Block.fromStateId(stateId))
  }

  getBlockStateId (pos) {
    return super.getBlock(pos.x, pos.y, pos.z)?.stateId
  }
}

module.exports = (version) => {
  return ChunkColumnWrapped
}
