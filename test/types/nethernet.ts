import { createClient, createServer, Relay, ping, NethernetServerAdvertisement } from '../..'
import { Authflow } from 'prismarine-auth'

const authflow = new Authflow()
createClient({ transport: 'nethernet', nethernet: { networkId: 123n, signalling: 'services', signallingConnectTimeout: 10000 }, authflow })
createClient({ realms: { realmId: '123' } })
createClient({ world: { pickSession: async sessions => sessions[0] } })
createServer({ transport: 'nethernet', nethernet: { networkId: '123', signalling: 'services' }, authflow, onMsaCode: code => console.log(code.message) })
new Relay({ offline: true, destination: { transport: 'nethernet', nethernet: { networkId: 123n, signalling: 'services' } } })
new Relay({ destination: { host: 'localhost', port: 19132 } })
const advertisement = new NethernetServerAdvertisement({ motd: 'test' }, '1.26.45')
NethernetServerAdvertisement.fromBuffer(advertisement.toBuffer())
ping({ nethernet: { networkId: 123n } }).then(ad => ad.gameVersion)
ping({ host: 'localhost', port: 19132 }).then(ad => ad.portV4)
// @ts-expect-error Unknown transports are not valid.
createClient({ transport: 'tcp' })
// @ts-expect-error Network IDs must retain 64-bit precision.
createClient({ transport: 'nethernet', nethernet: { networkId: 123 } })

ping({ nethernet: { networkId: 123n }, timeout: 1000, signal: new AbortController().signal })

// @ts-expect-error Nethernet settings are nested, not top-level aliases.
createClient({ transport: 'nethernet', useSignalling: true })
// @ts-expect-error Select an explicit signalling mode.
createClient({ nethernet: { signalling: 'websocket' } })

createClient({ host: 'localhost', pingTimeout: 1000, connectTimeout: 9000, useRaknetWorkers: false })
// @ts-expect-error The public option matches the runtime plural spelling.
createClient({ useRaknetWorker: false })
// @ts-expect-error The signalling deadline explicitly names connection setup.
createClient({ nethernet: { signallingTimeout: 1000 } })
