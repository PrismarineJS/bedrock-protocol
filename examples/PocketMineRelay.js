const { Relay } = require('bedrock-protocol')


function generateRandomString(length = 10) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '';
  
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomString += characters.charAt(randomIndex);
    }
  
    return randomString;
}

// Start your server first on port 19131.

// Start the proxy server
const relay = new Relay({
  version: '1.20.50', // The version
  /* host and port to listen for clients on */
  host: '0.0.0.0',
  port: 19132,
  /* Where to send upstream packets to */
  destination: {
    host: '127.0.0.1',
    port: 19131
  }
})
relay.conLog = console.debug
relay.listen() // Tell the server to start listening.

relay.on('connect', player => {
  console.log('New connection', player.connection.address)

  // Server is sending a message to the client.
  player.on('clientbound', ({ name, params }) => {
    if (name === 'crafting_data') { 
        // The RecipeIDs that are sent by PocketMine are not being recognised and 
        // the relay thinks its an empty string (If you try to console.log it that will log nothing)
        params.recipes.forEach(recipe => {
            if(String(recipe.recipe.recipe_id).startsWith("\u0000")){
                let newId = generateRandomString(32);
                recipe.recipe.recipe_id = newId;
            } 
         });
    }
  })
})
