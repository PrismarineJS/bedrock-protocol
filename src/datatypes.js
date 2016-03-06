'use strict';

var nbt = require('prismarine-nbt');

function readUUID(buffer, offset) {
  if(offset+16>buffer.length)
    throw new PartialReadError();
  return {
    value: UUID.stringify(buffer.slice(offset,16+offset)),
    size: 16
  };
}

function writeUUID(value, buffer, offset) {
  const buf=UUID.parse(value);
  buf.copy(buffer,offset);
  return offset + 16;
}

function readNbt(buffer, offset) {
  return nbt.proto.read(buffer,offset,"nbt");
}

function writeNbt(value, buffer, offset) {
  return nbt.proto.write(value,buffer,offset,"nbt");
}

function sizeOfNbt(value) {
  return nbt.proto.sizeOf(value,"nbt");
}

function readEntityMetadata(buffer, offset, _ref) {
  var type = _ref.type;
  var endVal = _ref.endVal;

  var cursor = offset;
  var metadata = [];
  var item = undefined;
  while (true) {
    if (offset + 1 > buffer.length) throw new PartialReadError();
    item = buffer.readUInt8(cursor);
    if (item === endVal) {
      return {
        value: metadata,
        size: cursor + 1 - offset
      };
    }
    var results = this.read(buffer, cursor, type, {});
    metadata.push(results.value);
    cursor += results.size;
  }
}

function writeEntityMetadata(value, buffer, offset, _ref2) {
  var type = _ref2.type;
  var endVal = _ref2.endVal;

  var self = this;
  value.forEach(function (item) {
    offset = self.write(item, buffer, offset, type, {});
  });
  buffer.writeUInt8(endVal, offset);
  return offset + 1;
}

function sizeOfEntityMetadata(value, _ref3) {
  var type = _ref3.type;

  var size = 1;
  for (var i = 0; i < value.length; ++i) {
    size += this.sizeOf(value[i], type, {});
  }
  return size;
}

module.exports = {
  'uuid': [readUUID, writeUUID, 16],
  'nbt': [readNbt, writeNbt, sizeOfNbt],
  'entityMetadataLoop': [readEntityMetadata, writeEntityMetadata, sizeOfEntityMetadata]
};
