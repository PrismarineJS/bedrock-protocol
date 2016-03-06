var Server = require('./server');

function createServer(options) {
  options = options || {};
  var port = options.port != null ?
    options.port :
    options['server-port'] != null ?
    options['server-port'] :
    19132;
  var host = options.host || '0.0.0.0';
  var kickTimeout = options.kickTimeout || 10 * 1000;
  var checkTimeoutInterval = options.checkTimeoutInterval || 4 * 1000;
  var onlineMode = options['online-mode'] == null ? true : options['online-mode'];
  var beforePing = options.beforePing || null;
  var enablePing = options.ping == null ? true : options.ping;

  var server = new Server();

  server.name = options.name || "Minecraft Server";
  server.motd = options.motd || "A Minecraft server";
  server.maxPlayers = options['max-players'] || 20;
  server.playerCount = 0;
  server.onlineModeExceptions = {};

  server.on("connection", function (client) {
    client.once('player_identification', onLogin);
    client.on('end', onEnd);

    var ping = true;
    var pingTimer = null;

    function pingLoop() {
      client.write('ping', {});
    }

    function startPing() {
      pingTimer = setInterval(pingLoop, checkTimeoutInterval);
    }

    function onEnd() {
      clearInterval(pingTimer);
    }

    function onLogin(packet) {
      client.username=packet.username;
      client.identification_byte=packet.unused;

      if(options.handshake)
      {
        options.handshake(function(){
          continueLogin();
        })
      }
      else
        continueLogin();
    }

    function continueLogin() {
      // we should probably implement the login protocol here
      server.emit('login', client);
      startPing();
    }
  });
  server.listen(port, host);
  return server;
}

module.exports = createServer;
