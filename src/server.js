'use strict';

var net = require('net');
var EventEmitter = require('events').EventEmitter;
var Client = require('./client');

class Server extends EventEmitter {

  constructor() {
    super();
  }

  listen(port, host) {
    var self = this;
    var nextId = 0;
    self.socketServer = net.createServer();
    self.socketServer.on('connection', socket => {
      var client = new Client(true);
      // client._end = client.end;
      // client.end = function end(endReason) {
      //   client.write('disconnect_player', {
      //     disconnect_reason: endReason
      //   });
      //   client._end(endReason);
      // };
      client.id = nextId++;
      self.clients[client.id] = client;
      client.on('end', function () {
        delete self.clients[client.id];
      });
      client.setSocket(socket);
      self.emit('connection', client);
    });
    self.socketServer.on('error', function (err) {
      self.emit('error', err);
    });
    self.socketServer.on('close', function () {
      self.emit('close');
    });
    self.socketServer.on('listening', function () {
      self.emit('listening');
    });
    self.socketServer.listen(port, host);
  }

  close() {
    var client;
    for (var clientId in this.clients) {
      if (!this.clients.hasOwnProperty(clientId)) continue;

      client = this.clients[clientId];
      client.end('ServerShutdown');
    }
    this.socketServer.close();
  }
}

module.exports = Server;
