const { createLoginVerifier } = require('../auth/loginVerifier')

module.exports = (client, server, options, dependencies = {}) => {
  client.verifyLogin = createLoginVerifier(options, dependencies).verifyLogin
}
