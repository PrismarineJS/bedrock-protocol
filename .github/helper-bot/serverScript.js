// Minecraft Bedrock Edition behavior pack script to extract block data.
// Based off https://github.com/Alemiz112/BedrockUtils/tree/master/BlockPaletteDumperAddon
import {
  BlockStates,
  BlockTypes,
  BlockPermutation
} from '@minecraft/server'

const data = {
  blocks: [],
  blockProperties: BlockStates.getAll()
}

const blocks = BlockTypes.getAll()
for (let i = 0; i < blocks.length; i++) {
  const permutation = BlockPermutation.resolve(blocks[i].id)
  const defaultPermutation = permutation.getAllStates()
  const blockData = {
    name: blocks[i].id,
    defaultState: defaultPermutation,
    stateTypes: Object.fromEntries(Object.keys(defaultPermutation).map(e => [e, typeof e])),
    stateValues: {}
  }
  const stateNames = Object.keys(defaultPermutation)
  for (let j = 0; j < stateNames.length; j++) {
    const stateName = stateNames[j]
    const state = BlockStates.get(stateName)
    const validValues = state.validValues
    blockData.stateValues[stateName] = validValues
  }
  data.blocks.push(blockData)
}

console.warn('<BLOCK_DATA>' + JSON.stringify(data) + '</BLOCK_DATA>')
