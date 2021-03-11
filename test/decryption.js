const crypto=require("crypto");
const assert=require("assert");
const bufferEqual=require("buffer-equal");

// based on https://s.yawk.at/8W5U and https://confluence.yawk.at/display/PEPROTOCOL/Encryption
describe("decryption",() => {
  let decipher;
  before(() => {

    let secretKeyBytes = new Buffer("ZOBpyzki/M8UZv5tiBih048eYOBVPkQE3r5Fl0gmUP4=","base64");

    /////

    let iv = secretKeyBytes.slice(0,16);

    assert(bufferEqual(iv, new Buffer("ZOBpyzki/M8UZv5tiBih0w==","base64")));


    decipher = crypto.createDecipheriv('aes-256-cfb8', secretKeyBytes, iv);
  });


  it("decrypt 1",cb => {
    let packet1Encrypted = new Buffer("4B4FCA0C2A4114155D67F8092154AAA5EF","hex");
    decipher.once('data', packet1Decrypted => {
      assert(bufferEqual(packet1Decrypted, new Buffer("0400000000499602D2FC2FCB233F34D5DD", "hex")));
      cb();
    });
    decipher.write(packet1Encrypted);
  });


  it("decrypt 2",cb => {
    let packet2Encrypted = new Buffer("DF53B9764DB48252FA1AE3AEE4","hex");
    decipher.once('data', packet2Decrypted => {
      assert(bufferEqual(packet2Decrypted,new Buffer("3C000000085A446D11C0C7AA5A","hex")));
      cb();
    });
    decipher.write(packet2Encrypted);
  })
});