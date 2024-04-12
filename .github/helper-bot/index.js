// Automatic version update checker for Minecraft bedrock edition.
const fs = require('fs')
const { join } = require('path')
const cp = require('child_process')
const core = require('@actions/core')
const helper = require('gh-helpers')()
const latestVersionEndpoint = 'https://itunes.apple.com/lookup?bundleId=com.mojang.minecraftpe&time=' + Date.now()
const changelogURL = 'https://feedback.minecraft.net/hc/en-us/sections/360001186971-Release-Changelogs'

// Relevant infomation for us is:
// "version": "1.17.10",
// "currentVersionReleaseDate": "2021-07-13T15:35:49Z",
// "releaseNotes": "What's new in 1.17.10:\nVarious bug fixes",

function buildFirstIssue (title, result, externalPatches) {
  let commitData = ''
  const date = new Date(result.currentVersionReleaseDate).toUTCString()

  for (const name in externalPatches) {
    const [patches, diff] = externalPatches[name]
    commitData += '### ' + name + '\n'
    for (const [name, url] of patches) {
      commitData += `<a href="${url}">${name}</a>\n`
    }
    if (diff) commitData += `\n**[See the diff between *${result.currentVersionReleaseDate}* and now](${diff})**\n`
    else commitData += '\n(No changes so far)\n'
  }

  return {
    title,
    body: `
A new Minecraft Bedrock version is available (as of ${date}), version **${result.version}**

## Official Changelog
* ${result.releaseNotes} *(via App Store)*
* ${changelogURL}

## 3rd party protocol patches
${commitData}

## Protocol Details
<table>
  <tr><td><b>Name</b></td><td>${result.version}</td>
  <!--(Special Server Version?)-->
  <!--<tr><td><b>Protocol ID</b></td><td></td>-->
  <!--<tr><td><b>Partly Already Compatible</b></td><td></td>-->
</table>

*I'll try to close this issue automatically if the protocol version didn't change. If the protocol version did change, the automatic update system will try to complete an update to minecraft-data and bedrock-protocol and if successful it will auto close this issue.*

-----

🤖 I am a bot, I check for updates every 2 hours without a trigger. You can close this issue to prevent any further updates.
    `
  }
}

async function getCommitsInRepo (repo, containing, since) {
  const endpoint = `https://api.github.com/repos/${repo}/commits`
  console.log('Getting', endpoint)
  const commits = await fetch(endpoint).then(res => res.json())
  const relevant = []
  for (const commit of commits) {
    if (commit.commit.message.includes(containing)) {
      console.log('commit url', commit.html_url)
      relevant.push([commit.commit.message, commit.html_url])
    }
  }
  if (since) {
    cp.execSync(`curl -L ${endpoint}?since=${since} -o commits.json`, { stdio: 'inherit', shell: true })
    const commits = JSON.parse(fs.readFileSync('./commits.json', 'utf-8'))
    if (commits.length) {
      const head = commits[0].sha
      const tail = commits[commits.length - 1].sha
      return [relevant, `https://github.com/${repo}/compare/${tail}..${head}`]
    }
  }
  return [relevant]
}

async function fetchLatest () {
  // curl -L "https://itunes.apple.com/lookup?bundleId=com.mojang.minecraftpe" -o results.json
  const json = await fetch(latestVersionEndpoint).then(res => res.json())
  const result = json.results[0]

  const currentTypes = fs.readFileSync(join(__dirname, '../../index.d.ts'), 'utf-8')
  const supportedVersions = currentTypes.match(/type Version = ([^\n]+)/)[1].replace(/\||'/g, ' ').split(' ').map(k => k.trim()).filter(k => k.length)
  console.log('Supported versions', supportedVersions)

  let { version, currentVersionReleaseDate, releaseNotes } = result
  console.log(version, currentVersionReleaseDate, releaseNotes)

  const title = `Support Minecraft ${result.version}`
  const issueStatus = await helper.findIssue({ titleIncludes: title }) || {}

  if (supportedVersions.includes(version)) {
    if (issueStatus.isOpen) {
      helper.close(issueStatus.id, `Closing as ${version} is now supported`)
    }
    console.log('Latest version is supported.')
    return
  }

  if (issueStatus.isClosed) {
    // We already made an issue, but someone else already closed it, don't do anything else
    console.log('I already made an issue, but it was closed')
    return
  }

  version = version.replace('.0', '')
  const issuePayload = buildFirstIssue(title, result, {
    PocketMine: await getCommitsInRepo('pmmp/PocketMine-MP', version, currentVersionReleaseDate),
    gophertunnel: await getCommitsInRepo('Sandertv/gophertunnel', version, currentVersionReleaseDate),
    CloudburstMC: await getCommitsInRepo('CloudburstMC/Protocol', version, currentVersionReleaseDate)
  })

  if (issueStatus.isOpen) {
    await helper.updateIssue(issueStatus.id, issuePayload)
    // TEMP TEST
    core.setOutput('updateVersion', version)
    core.setOutput('issueNumber', issueStatus.id)
  } else {
    const issue = await helper.createIssue(issuePayload)
    core.setOutput('updateVersion', version)
    core.setOutput('issueNumber', issue.number)
  }

  fs.writeFileSync('./issue.md', issuePayload.body)
  console.log('OK, wrote to ./issue.md', issuePayload)
}

fetchLatest()
