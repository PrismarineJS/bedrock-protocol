'use strict';
var ProtoDef = require('protodef').ProtoDef;
var Serializer = require('protodef').Serializer;
var Parser = require('protodef').Parser;

var protocol = require('../../data/protocol.json').types;

function createProtocol() {
  var proto = new ProtoDef();
  proto.addTypes(require('../datatypes/minecraft'));
  proto.addTypes(protocol);

  return proto;
}

function createSerializer() {
  var proto = createProtocol();
  return new Serializer(proto, 'packet');
}

function createDeserializer() {
  var proto = createProtocol();
  return new Parser(proto, 'packet');
}

module.exports = {
  createDeserializer: createDeserializer,
  createSerializer: createSerializer,
  createProtocol: createProtocol
};
