const { ping } = require('bedrock-protocol')

ping({ host: 'play.cubecraft.net', port: 19132 }).then(res => {
  console.log(res)
})
