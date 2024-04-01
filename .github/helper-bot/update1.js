const fs = require('fs')
const core = require('@actions/core')
const github = require('gh-helpers')()
const bedrock = require('bedrock-protocol')
const { sleep } = require('bedrock-protocol/src/datatypes/util')
const bedrockServer = require('minecraft-bedrock-server')
const path = require('path')

async function tryConnect (opts) {
  const client = bedrock.createClient({
    host: 'localhost',
    port: 19132,
    username: 'test',
    offline: true
  })
  client.on('connect_allowed', () => { Object.assign(client.options, opts) })

  return new Promise((resolve, reject) => {
    const collected = {}
    const forCollection = ['start_game', 'available_commands']
    for (const packet of forCollection) {
      client.once(packet, (data) => {
        collected[packet] = data
        fs.writeFileSync(path.join(__dirname, '/collected.json'), JSON.stringify(collected, null, 2))
      })
      if (Object.keys(collected).length === forCollection.length) {
        resolve(collected)
      }
    }

    setTimeout(() => {
      if (Object.keys(collected).length !== forCollection.length) {
        reject(Error('Unable to collect all packets'))
      }
    }, 1000 * 60 * 6)
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
  const root = path.resolve(path.join(__dirname, '../../tools'))
  const serverPath = root + '/bds-' + serverVersion
  console.log('Server version', serverVersion, root, 'Server path', serverPath)
  core.setOutput('serverVersion', serverVersion)
  core.setOutput('serverPath', serverPath)
  core.setOutput('serverBin', serverPath + '/bedrock_server_symbols.debug')
  const handle = await bedrockServer.startServerAndWait(serverVersion, 60000, { root })
  await sleep(9000)
  const pong = await bedrock.ping({ host: 'localhost', port: 19130 })
  updatedBody = updatedBody.replace('<!--<tr><td><b>Protocol ID</b></td><td></td>-->', `<tr><td><b>Protocol ID</b></td><td>${pong.protocol} (${pong.version})</td>`)
  try {
    await tryConnect({ protocolVersion: pong.protocol })
    updatedBody = updatedBody.replace('<!--<tr><td><b>Partly Already Compatible</b></td><td></td>-->', '<!--<tr><td><b>Partly Already Compatible</b></td>Yes<td></td>-->')
  } catch (e) {
    console.error(e)
    updatedBody = updatedBody.replace('<!--<tr><td><b>Partly Already Compatible</b></td><td></td>-->', '<tr><td><b>Partly Already Compatible</b></td>NO<td></td>')
  }
  fs.writeFileSync(path.join(__dirname, '/updatedBody.md', updatedBody))
  await github.updateIssue({ number: inputIssueNo, body: updatedBody })
  handle.kill()
  console.log('✅ Finished working with Linux server binary')
  console.log('Working now on Windows')
  const winPath = serverPath.replace('bds-', 'bds-win-')
  await bedrockServer.downloadServer(latestServers.windows.version3, winPath)
  core.setOutput('serverWinPath', winPath)
  core.setOutput('serverWinBin', winPath + '/bedrock_server.exe')
  core.setOutput('serverWinPdb', winPath + '/bedrock_server.pdb')
  console.log('✅ Finished working with Windows server binary')
}

// main(process.env.UPDATE_VERSION, process.env.ISSUE_NUMBER)
main(process.env.UPDATE_VERSION, process.env.ISSUE_NUMBER)

// TODO: determine if protocol version has changed before doing anything