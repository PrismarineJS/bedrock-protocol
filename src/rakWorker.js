const { Worker, isMainThread, parentPort } = require('worker_threads')
const { Client, EncapsulatedPacket, Reliability } = require('jsp-raknet')
const debug = require('debug')('minecraft-protocol')

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
      raknet = new Client(host, port)

      raknet.connect().then(() => {
        debug('Raknet Connected!')
      })

      raknet.on('connecting', () => {
        debug(`[client] connecting to ${host}/${port}`)
        parentPort.postMessage('message', { type: 'connecting' })
      })

      raknet.once('connected', (connection) => {
        debug('[worker] connected!')
        globalThis.raknetConnection = connection
        parentPort.postMessage({ type: 'connected' })
      })

      raknet.on('encapsulated', (...args) => {
        parentPort.postMessage({ type: 'encapsulated', args })
      })

      raknet.on('disconnect', (reason) => {
        debug('[worker] disconnected!')
        parentPort.postMessage({ type: 'disconnect', reason })
      })

      raknet.on('raw', (buffer, inetAddr) => {
        debug('Raw packet', buffer, inetAddr)
      })
    } else if (evt.type === 'queueEncapsulated') {
      const sendPacket = new EncapsulatedPacket()
      sendPacket.reliability = Reliability.ReliableOrdered
      sendPacket.buffer = evt.packet

      globalThis.raknetConnection?.addEncapsulatedToQueue(sendPacket)
      if (evt.immediate) {
        globalThis.raknetConnection?.sendQueue()
      }
    } else if (evt.type === 'close') {
      raknet.close()
      process.exit(0)
    } else if (evt.type === 'ping') {
      raknet.ping((args) => {
        parentPort.postMessage({ type: 'pong', args })
      })
    }
  })
}

if (!isMainThread) main()
module.exports = { connect }
