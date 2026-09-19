const debug = require('debug')('minecraft-protocol')

// Attempt every cleanup even if one resource fails. Client.close() is synchronous,
// so this helper must also consume rejections from asynchronous session teardown.
async function closeNethernet (nethernet) {
  const results = await Promise.allSettled([
    Promise.resolve().then(() => nethernet?.signalling?.destroy()),
    Promise.resolve().then(() => nethernet?.session?.end())
  ])
  for (const result of results) {
    if (result.status === 'rejected') debug('Nethernet cleanup failed', result.reason)
  }
}

module.exports = { closeNethernet }
