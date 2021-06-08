const { Versions } = require('../src/options')

module.exports = (version) =>
  class Item {
    nbt
    constructor (obj) {
      this.networkId = 0
      this.runtimeId = 0
      this.count = 0
      this.metadata = 0
      Object.assign(this, obj)
      this.version = version
    }

    static fromBedrock (obj) {
      if (Versions[version] >= Versions['1.16.220']) {
        return new Item({
          networkId: obj.network_id,
          stackId: obj.stack_id,
          blockRuntimeId: obj.block_runtime_id,
          count: obj.count,
          metadata: obj.metadata,
          nbt: obj.extra.nbt
        })
      } else {
        return new Item({
          networkId: obj.runtime_id,
          sackId: obj.item?.network_id,
          count: obj.item?.auxiliary_value & 0xff,
          metadata: obj.item?.auxiliary_value >> 8,
          nbt: obj.item?.nbt?.nbt
        })
      }
    }

    toBedrock () {
      if (Versions[version] >= Versions['1.16.220']) {
        return {
          network_id: this.networkId,
          count: this.count,
          metadata: this.metadata,
          has_stack_id: this.stackId,
          stack_id: this.stackId,
          extra: {
            has_nbt: !!this.nbt,
            nbt: { version: 1, nbt: this.nbt },
            can_place_on: [],
            can_destroy: [],
            blocking_tick: 0
          }
        }
      } else {
        return {
          runtime_id: this.runtimeId,
          item: {
            network_id: this.networkId,
            auxiliary_value: (this.metadata << 8) | (this.count & 0xff),
            has_nbt: !!this.nbt,
            nbt: { version: 1, nbt: this.nbt },
            can_place_on: [],
            can_destroy: [],
            blocking_tick: 0
          }
        }
      }
    }
  }
