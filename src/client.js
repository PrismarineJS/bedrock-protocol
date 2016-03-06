'use strict';

var EventEmitter = require('events').EventEmitter;
var debug = require('./debug');

var createSerializer = require("./transforms/serializer").createSerializer;
var createDeserializer = require("./transforms/serializer").createDeserializer;

class Client extends EventEmitter {

  constructor(isServer) {
    super();
    this.isServer = !!isServer;
  }

  setSerializer() {
    this.serializer = createSerializer(this.isServer);
    this.deserializer = createDeserializer(this.isServer);


    this.serializer.on('error', (e) => {
      var parts = e.field.split(".");
      parts.shift();
      e.message = `Serialization error for ${e.message}`;
      this.emit('error', e);
    });


    this.deserializer.on('error', (e) => {
      var parts = e.field.split(".");
      parts.shift();
      e.message = `Deserialization error for ${e.message}`;
      this.emit('error', e);
    });

    this.deserializer.on('data', (parsed) => {
      parsed.metadata.name = parsed.data.name;
      parsed.data = parsed.data.params;
      this.emit('packet', parsed.data, parsed.metadata);

      debug("reading packet " + "." + parsed.metadata.name);
      debug(parsed.data);
      this.emit(parsed.metadata.name, parsed.data, parsed.metadata);
      this.emit('raw.' + parsed.metadata.name, parsed.buffer, parsed.metadata);
      this.emit('raw', parsed.buffer, parsed.metadata);
    });
  }

  setSocket(socket) {
    var ended = false;

    var endSocket = function() {
      if (ended) return;
      ended = true;
      this.socket.removeListener('close', endSocket);
      this.socket.removeListener('end', endSocket);
      this.socket.removeListener('timeout', endSocket);
      this.emit('end', this._endReason);
    };

    var onFatalError = function(err) {
      this.emit('error', err);
      endSocket();
    };

    var onError = function(err) {
      this.emit('error', err);
    }

    this.socket = socket;

    if (this.socket.setNoDelay) {
      this.socket.setNoDelay(true);
    }

    this.socket.on('connect', function() {
      this.emit('connect');
    });

    this.socket.on('error', onFatalError);
    this.socket.on('close', endSocket);
    this.socket.on('end', endSocket);
    this.socket.on('timeout', endSocket);

    this.setSerializer();
    this.socket.pipe(this.deserializer);
    this.serializer.pipe(this.socket);
  }

  end(reason) {
    this._endReason = reason;
    if (this.socket)
      this.socket.end();
  }

  write(name, params) {
    debug("writing packet " + "." + name);
    debug(params);
    this.serializer.write({
      name,
      params
    });
  }

  writeRaw(buffer) {
    this.socket.write(buffer);
  }
}

module.exports = Client;
