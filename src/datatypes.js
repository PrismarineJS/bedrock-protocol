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

module.exports = {
  'uuid': [readUUID, writeUUID, 16],
  'nbt': [readNbt, writeNbt, sizeOfNbt]
};
