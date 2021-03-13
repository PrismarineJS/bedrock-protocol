const { Relay } = require('../src/relay')

function createRelay () {
  console.log('Creating relay')
  /**
   * Example to create a non-transparent proxy (or 'Relay') connection to destination server
   * In Relay we de-code and re-encode packets
   */
  const relay = new Relay({
    /* Hostname and port for clients to listen to */
    hostname: '0.0.0.0',
    port: 19130,
    /**
     * Who does the authentication
     * If set to `client`, all connecting clients will be sent a message with a link to authenticate
     * If set to `server`, the server will authenticate and only one client will be able to join
     * (Default) If set to `none`, no authentication will be done
     */
    auth: 'server',

    /**
     * Sets if packets will automatically be forwarded. If set to false, you must listen for on('packet')
     * events and
     */
    auto: true,

    /* Where to send upstream packets to */
    destination: {
      hostname: '127.0.0.1',
      port: 19132
      // encryption: true
    }
  })

  relay.create()
}

createRelay()
