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

  github.findIssue = () => ({ body: '(Demo)' })
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

  return new Promise((resolve, reject) => {
    let timeout // eslint-disable-line
    function done (data) {
      client.close()
      clearTimeout(timeout)
      resolve(data)
    }
    const collected = {}
    const forCollection = ['start_game', 'available_commands']
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

    timeout = setTimeout(() => {
      if (Object.keys(collected).length !== forCollection.length) {
        reject(Error('Unable to collect all packets'))
      }
    }, 1000 * 60 * 2)
  })
}

async function main (inputUpdateVer, inputIssueNo) {
  const issue = await github.findIssue({ number: inputIssueNo })
  const latestServers = await bedrockServer.getLatestVersions()
  let updatedBody = issue.body
  const serverVersion = latestServers.linux.version3
  if (serverVersion !== inputUpdateVer) {
    updatedBody = updatedBody.replace('<!--(Special Server Version?)-->', `<tr><td><b>Server version</b></td><td>${serverVersion}</td>`)
  }
  const root = __dirname
  const serverPath = root + '/bds-' + serverVersion
  console.log('Server version', serverVersion, root, 'Server path', serverPath)
  core.setOutput('serverVersion', serverVersion)
  core.setOutput('serverPath', serverPath)
  core.setOutput('serverBin', serverPath + '/bedrock_server_symbols.debug')
  const handle = await bedrockServer.startServerAndWait(serverVersion, 60000, { root: __dirname })
  const pong = await bedrock.ping({ host: '127.0.0.1', port: 19130 })
  updatedBody = updatedBody.replace('<!--<tr><td><b>Protocol ID</b></td><td></td>-->', `<tr><td><b>Protocol ID</b></td><td>${pong.protocol} (${pong.version})</td>`)
  try {
    await tryConnect({ protocolVersion: pong.protocol })
    updatedBody = updatedBody.replace('<!--<tr><td><b>Partly Already Compatible</b></td><td></td>-->', '<!--<tr><td><b>Partly Already Compatible</b></td>Yes<td></td>-->')
  } catch (e) {
    console.error(e)
    updatedBody = updatedBody.replace('<!--<tr><td><b>Partly Already Compatible</b></td><td></td>-->', '<tr><td><b>Partly Already Compatible</b></td>NO<td></td>')
  }
  fs.writeFileSync(path.join(__dirname, '/updatedBody.md'), updatedBody)
  await github.updateIssue(inputIssueNo, { body: updatedBody })
  handle.kill()

  // Check if protocol version has changed
  if (false && pong.protocol === latestSupportedProtocol) {
    console.log('Protocol version has not changed')
    // Close the github issue
    await github.close(inputIssueNo, 'Protocol version has not changed, assuming no compatibility issues.')
    core.setOutput('needsUpdate', false)
    return
  } else {
    core.setOutput('needsUpdate', true)
    core.setOutput('protocolVersion', pong.protocol)
  }

  console.log('✅ Finished working with Linux server binary')
  console.log('Working now on Windows')
  const winPath = serverPath.replace('bds-', 'bds-win-')
  await bedrockServer.downloadServer(latestServers.windows.version3, { path: winPath })
  core.setOutput('serverWinPath', winPath)
  core.setOutput('serverWinBin', winPath + '/bedrock_server.exe')
  core.setOutput('serverWinPdb', winPath + '/bedrock_server.pdb')
  console.log('✅ Finished working with Windows server binary')
}

main(process.env.UPDATE_VERSION, process.env.ISSUE_NUMBER)
// main('1.20.73', 0)
