# Documentation

## be.createClient(options)

Returns a `Client` instance and starts listening. All clients will be
automatically logged in and validated against microsoft's auth.

`options` is an object containing the properties :
 * host : default to undefined which means listen to all available ipv4 and ipv6 adresses
 * port (optional) : default to 25565
 (see https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback for details)
 * kickTimeout (optional) : default to `10*1000` (10s), kick client that doesn't answer to keepalive after that time
 * version (optional) : default to latest stable version, version of server
 * autoInitPlayer (optional) : default to true, If we should send SetPlayerInitialized to the server after getting play_status spawn.
 * offline (optional) : default to false, whether to auth with microsoft
 * connectTimeout (optional) : default to 9000, ms to wait before aborting connection attempt
