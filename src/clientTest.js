process.env.DEBUG = 'minecraft-protocol raknet'
const { Client } = require('./client')

// console.log = () => 

async function test() {
    const client = new Client({
        hostname: '127.0.0.1',
        port: 19132
    })
    
    client.once('resource_packs_info', (packet) => {
        client.write('resource_pack_client_response', {
            response_status: 'completed',
            resourcepackids: []
        })
    })
}

test()