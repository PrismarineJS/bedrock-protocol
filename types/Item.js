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
      return new Item({
        runtimeId: obj.runtime_id,
        networkId: obj.item?.network_id,
        count: obj.item?.auxiliary_value & 0xff,
        metadata: obj.item?.auxiliary_value >> 8,
        nbt: obj.item?.nbt?.nbt
      })
    }

    toBedrock () {
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
