/* eslint-disable no-var, no-extend-native */
const fs = require('fs')
const path = require('path')
const mcData = require('minecraft-data')
const latestSupportedProtocol = mcData.versions.bedrock[0].version
const bedrock = require('bedrock-protocol')
const bedrockServer = require('minecraft-bedrock-server')
let core
/** @type {import('gh-helpers').GithubHelper} */
let github
if (process.env.CI) {
  core = require('@actions/core')
  github = require('gh-helpers')()
} else {
  globalThis.isMocha = true
  core = { setOutput: (name, value) => console.log(name, value) }
  github = require('gh-helpers')()
  github.getIssue = () => ({ body: '(Demo)' })
}

BigInt.prototype.toJSON = function () {
  return this.toString()
}

async function tryConnect (opts) {
  const client = bedrock.createClient({
    host: 'localhost',
    port: 19130,
    username: 'test',
    offline: true
  })
  client.on('connect_allowed', () => { Object.assign(client.options, opts) })

  const collected = {}
  const forCollection = ['start_game', 'available_commands']

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (Object.keys(collected).length !== forCollection.length) {
        reject(Error('Unable to collect all packets'))
      }
    }, 1000 * 60 * 2)

    function done (data) {
      client.close()
      clearTimeout(timeout)
      resolve(data)
    }

    for (const packet of forCollection) {
      console.log('Waiting for', packet)
      client.once(packet, (data) => {
        console.log('Received', packet)
        collected[packet] = data
        fs.writeFileSync(path.join(__dirname, '/collected.json'), JSON.stringify(collected, null, 2))
        if (Object.keys(collected).length === forCollection.length) {
          done(collected)
        }
      })
    }
  })
}

async function main (inputUpdateVer, inputIssueNo) {
  const issue = await github.getIssue(inputIssueNo)
  const latestServers = await bedrockServer.getLatestVersions()
  console.log('Issue data', issue)
  let updatedBody = issue.body
  const serverVersion = latestServers.linux.version3
  if (serverVersion !== inputUpdateVer) {
    updatedBody = updatedBody.replace('<!--(Special Server Version?)-->', `<tr><td><b>Server version</b></td><td>${serverVersion}</td>`)
  }
  const server = await bedrockServer.prepare(serverVersion, { root: __dirname })
  const serverPath = server.path
  console.log('Server version', serverVersion, 'Server path', serverPath)
  core.setOutput('serverVersion', serverVersion)
  core.setOutput('serverPath', serverPath)
  core.setOutput('serverBin', serverPath + '/bedrock_server_symbols.debug')
  await server.clearBehaviorPacks()
  const handle = await server.startAndWaitReady(60000)
  await new Promise((resolve) => setTimeout(resolve, 2000))
  const pong = await bedrock.ping({ host: '127.0.0.1', port: 19130, timeout: 4000 })
  updatedBody = updatedBody.replace('<!--<tr><td><b>Protocol ID</b></td><td></td>-->', `<tr><td><b>Protocol ID</b></td><td>${pong.protocol} (${pong.version})</td>`)
  try {
    await tryConnect({ protocolVersion: pong.protocol })
    updatedBody = updatedBody.replace('<!--<tr><td><b>Partly Already Compatible</b></td><td></td>-->', '<tr><td><b>Partly Already Compatible</b></td><td>Yes<td></td>')
  } catch (e) {
    console.error(e)
    updatedBody = updatedBody.replace('<!--<tr><td><b>Partly Already Compatible</b></td><td></td>-->', '<tr><td><b>Partly Already Compatible</b></td><td>NO<td></td>')
  }
  fs.writeFileSync(path.join(__dirname, '/updatedBody.md'), updatedBody)
  await github.updateIssue(inputIssueNo, { body: updatedBody })
  console.log('Updated issue body', inputIssueNo, updatedBody)
  handle.kill()

  // Check if protocol version has changed
  if (pong.protocol === latestSupportedProtocol) {
    console.log('Protocol version has not changed')
    // Close the github issue
    await github.close(inputIssueNo, 'Protocol version has not changed, assuming no compatibility issues.')
    core.setOutput('needsUpdate', false)
    return
  } else {
    core.setOutput('needsUpdate', true)
    core.setOutput('protocolVersion', pong.protocol)
  }

  // If the protocol version was changed, start server again, but with a behavior pack
  console.log('⚒️ Re-running Bedrock server with extractor behavior pack')

  // First, determine the latest script version
  injectPack(server, '1.0.0-beta')
  const handle2 = await server.startAndWaitReady(10000)
  const scriptVersion = await collectScriptVersion(handle2)
  handle2.kill()

  // Re-run the server with the new script version
  injectPack(server, scriptVersion)
  const handle3 = await server.startAndWaitReady(10000)
  const blockData = await collectDump(handle3)
  fs.writeFileSync(path.join(__dirname, '/collectedBlockData.json'), blockData)
  handle3.kill()

  console.log('✅ Finished working with Linux server binary')
  console.log('Working now on Windows')
  const winPath = serverPath.replace('bds-', 'bds-win-')
  await bedrockServer.downloadServer(latestServers.windows.version3, { path: winPath, platform: 'windows' })
  core.setOutput('serverWinPath', winPath)
  core.setOutput('serverWinBin', winPath + '/bedrock_server.exe')
  core.setOutput('serverWinPdb', winPath + '/bedrock_server.pdb')
  console.log('✅ Finished working with Windows server binary')
}

main(process.env.UPDATE_VERSION, process.env.ISSUE_NUMBER)
// if (!process.env.CI) main('1.20.73', 0)

function collectScriptVersion (handle, timeout = 1000 * 20) {
  // The scripting API doesn't support semantic versioning with tilde or caret operators
  // so we need to extract the version from the server log
  let onceTimer
  let onceDone
  function onceWithDelay (fn, delay) {
    if (onceDone) return
    clearTimeout(onceTimer)
    onceTimer = setTimeout(() => {
      fn()
      onceDone = true
    }, delay)
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Error('Timeout while waiting for dump'))
    }, timeout)
    let total = ''
    function process (log) {
      const data = log.toString()
      total += data
      for (const line of total.split('\n')) {
        if (line.includes('@minecraft/server -')) {
          onceWithDelay(() => {
            const scriptVersion = line.split('@minecraft/server -')[1].trim()
            console.log('Latest @minecraft/server version is', scriptVersion)
            clearTimeout(timer)
            resolve(scriptVersion)
            handle.stdout.off('data', process)
          }, 500)
        }
      }
    }
    handle.stdout.on('data', process)
  })
}

function collectDump (handle, timeout = 1000 * 60 * 2) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Error('Timeout while waiting for dump'))
    }, timeout)
    let total = ''
    function process (log) {
      const data = log.toString()
      total += data
      for (const line of total.split('\n')) {
        if (line.includes('<BLOCK_DATA>') && line.includes('</BLOCK_DATA>')) {
          const blockData = line.split('<BLOCK_DATA>')[1].split('</BLOCK_DATA>')[0]
          clearTimeout(timer)
          resolve(blockData)
          handle.stdout.off('data', process)
          return
        }
      }
    }
    handle.stdout.on('data', process)
  })
}

function injectPack (/** @type {import('minecraft-bedrock-server').BedrockVanillaServer} */ server, scriptVersion) {
  server.clearBehaviorPacks()
  server.addQuickScript({
    manifest: {
      format_version: 2,
      header: {
        allow_random_seed: false,
        description: 'DataExtractor',
        name: 'DataExtractor',
        platform_locked: false,
        uuid: 'f604a121-974a-3e04-927a-8a1c9518c96a',
        version: [1, 0, 0],
        min_engine_version: [1, 20, 0]
      },
      modules: [{
        type: 'script',
        language: 'javascript',
        uuid: 'fa04a121-974a-3e04-927a-8a1c9518c96a',
        entry: 'scripts/main.js',
        version: [0, 1, 0]
      }],
      dependencies: [
        { module_name: '@minecraft/server', version: scriptVersion || '1.0.0-beta' }
      ]
    },
    scripts: {
      'scripts/main.js': path.join(__dirname, 'serverScript.js')
    }
  }, true, true)
  server.toggleExperiments({ gametest: true })
}
