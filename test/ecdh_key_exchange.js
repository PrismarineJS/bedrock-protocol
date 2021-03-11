const crypto=require("crypto");
var Ber = require('asn1').Ber;
const assert=require("assert");
const bufferEqual=require("buffer-equal");

// based on https://s.yawk.at/VZSf and https://confluence.yawk.at/display/PEPROTOCOL/Encryption
// and https://github.com/mhsjlw/pocket-minecraft-protocol/issues/15
describe("ecdh key exchange",() => {
  it("generate the secret",() => {

    const pubKeyStr = "MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEDEKneqEvcqUqqFMM1HM1A4zWjJC+I8Y+aKzG5dl+6wNOHHQ4NmG2PEXRJYhujyodFH+wO0dEr4GM1WoaWog8xsYQ6mQJAC0eVpBM96spUB1eMN56+BwlJ4H3Qx4TAvAs";

    var reader = new Ber.Reader(new Buffer(pubKeyStr, "base64"));
    reader.readSequence();
    reader.readSequence();
    reader.readOID(); // Hey, I'm an elliptic curve
    reader.readOID(); // This contains the curve type, could be useful

// The first byte is unused, it contains the "number of unused bits in last octet"
// The pubKey should start at "04" which signifies it is an "uncompressed" public key.
    var pubKey = new Buffer(reader.readString(Ber.BitString, true)).slice(1);

// It'd be better to get this from the curve type OID
    var server = crypto.createECDH('secp384r1');
//server.generateKeys();
    server.setPrivateKey("oH53xXsdMRt6VbjlUUggn/QTcUQUqOHcvHl+U1jaGAUe8TP9H3XdKeoqSAKrKBGG", "base64");
    let secret = server.computeSecret(pubKey);
    assert(bufferEqual(secret, new Buffer("sM5HvG6efG0RwRe7S+Er9ingxuVzC6HIXmQ1DITVkh4GmX7pboSzbLtaTTNKE8bJ", "base64")));

  });


  it("create the secret key",() => {
    let secret=new Buffer("sM5HvG6efG0RwRe7S+Er9ingxuVzC6HIXmQ1DITVkh4GmX7pboSzbLtaTTNKE8bJ", "base64");
    let hash = crypto.createHash('sha256');
    hash.update("SO SECRET VERY SECURE");
    hash.update(secret);
    let secretKey = hash.digest();

    let expected=new Buffer("PN/4NCtRswMTwfpOKRecbMncwxa91Fx4QSUlad46jrc","base64");
    assert(bufferEqual(secretKey,expected),secretKey.toString("base64")+"!="+expected.toString("base64"));
  })
});