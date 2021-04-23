const RakClient = require('jsp-raknet/client')
const { Worker, isMainThread, parentPort } = require('worker_threads')
const EncapsulatedPacket = require('jsp-raknet/protocol/encapsulated_packet')
const Reliability = require('jsp-raknet/protocol/reliability')

function connect (host, port) {
  if (isMainThread) {
    const worker = new Worker(__filename)
    worker.postMessage({ type: 'connect', host, port })
    return worker
  }
}

let raknet

function main () {
  parentPort.on('message', (evt) => {
    if (evt.type === 'connect') {
      const { host, port } = evt
      raknet = new RakClient(host, port)

      raknet.connect().then(() => {
        console.log('Raknet Connected!')
      })

      raknet.on('connecting', () => {
        console.log(`[client] connecting to ${host}/${port}`)
        parentPort.postMessage('message', { type: 'connecting' })
        console.log('Raknet', raknet)
      })

      raknet.once('connected', (connection) => {
        console.log('[worker] connected!')
        globalThis.raknetConnection = connection
        parentPort.postMessage({ type: 'connected' })
      })

      raknet.on('encapsulated', (...args) => {
        // console.log('-> ENCAP BUF', args)
        setTimeout(() => {
          parentPort.postMessage({ type: 'encapsulated', args })
        }, 100)
      })

      raknet.on('raw', (buffer, inetAddr) => {
        console.log('Raw packet', buffer, inetAddr)
      })
    } else if (evt.type === 'queueEncapsulated') {
      // console.log('SEND', globalThis.raknetConnection, evt.packet)

      const sendPacket = new EncapsulatedPacket()
      sendPacket.reliability = Reliability.ReliableOrdered
      sendPacket.buffer = evt.packet

      globalThis.raknetConnection?.addEncapsulatedToQueue(sendPacket)
      if (evt.immediate) {
        globalThis.raknetConnection?.sendQueue()
      }
    }
  })
}

if (!isMainThread) main()
module.exports = { connect }
