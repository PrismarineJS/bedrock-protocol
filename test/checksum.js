const crypto=require("crypto");
const assert=require("assert");
const bufferEqual=require("buffer-equal");

function writeLI64(value, buffer, offset) {
  buffer.writeInt32LE(value[0], offset+4);
  buffer.writeInt32LE(value[1], offset);
  return offset + 8;
}

// based on https://s.yawk.at/QADm and https://confluence.yawk.at/display/PEPROTOCOL/Encryption
describe("checksum",() => {
  it("generate hash and checksum",() => {
    let packetPlaintext = new Buffer("3C00000008","hex");
    let sendCounter = [0,1];
    let secretKeyBytes = new Buffer("ZOBpyzki/M8UZv5tiBih048eYOBVPkQE3r5Fl0gmUP4=","base64");

    /////

    let digest = crypto.createHash('sha256');
    // sendCounter to little-endian byte array
    let counter=new Buffer(8);
    writeLI64(sendCounter,counter,0);
    digest.update(counter);
    digest.update(packetPlaintext);
    digest.update(secretKeyBytes);
    let hash = digest.digest();
    assert(bufferEqual(hash, new Buffer("WkRtEcDHqlqesU6wdSnIz7cU3OCNKVMIsX3aXZMLRjQ=","base64")),hash.toString("base64"));

    let checksum = hash.slice(0,8);
    assert(bufferEqual(checksum, new Buffer("5A446D11C0C7AA5A","hex")));
  })
});