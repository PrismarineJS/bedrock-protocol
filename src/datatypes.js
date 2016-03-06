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

module.exports = {
  'uuid': [readUUID, writeUUID, 16],

  'metadatadictionary': [readLTriad, writeLTriad, 3],
  'skin': [readIpAddress, writeIpAddress, 4],
  'entitylocations': [readRestBuffer, writeRestBuffer, sizeOfRestBuffer],
  'blockrecords':[readEndOfArray,writeEndOfArray,sizeOfEndOfArray],
  'records':[readToByte,writeToByte,sizeOfToByte],
  'playerattributes': [],
  'item': [],
  'blockcoordinates': []
};
