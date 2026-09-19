// Automatic version update checker for Minecraft Bedrock Edition.
const helper = require('gh-helpers')()
const bedrockServer = require('minecraft-bedrock-server')
const { CURRENT_VERSION, Versions } = require('../../src/options')

const latestVersionEndpoint = 'https://itunes.apple.com/lookup?bundleId=com.mojang.minecraftpe&time=' + Date.now()
const changelogURL = 'https://feedback.minecraft.net/hc/en-us/sections/360001186971-Release-Changelogs'

async function fetchJson (url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`)
  return response.json()
}

async function readLatestRelease () {
  const { results: releases } = await fetchJson(latestVersionEndpoint)
  if (!releases?.length) throw new Error('The App Store response did not contain a release')
  return releases[0]
}

async function getCommitsInRepo (repo, containing, since) {
  const endpoint = `https://api.github.com/repos/${repo}/commits`
  console.log('Getting', endpoint)
  const commits = await fetchJson(endpoint)
  const relevant = commits
    .filter(commit => commit.commit.message.includes(containing))
    .map(commit => [commit.commit.message, commit.html_url])

  if (!since) return [relevant]

  const url = new URL(endpoint)
  url.searchParams.set('since', since)
  const recentCommits = await fetchJson(url)
  if (!recentCommits.length) return [relevant]

  const head = recentCommits[0].sha
  const tail = recentCommits[recentCommits.length - 1].parents[0]?.sha
  if (!tail) return [relevant]
  return [relevant, `https://github.com/${repo}/compare/${tail}..${head}`]
}

async function getProtocolPatches (version, releaseDate) {
  // Match both 26.10 and 1.26.10, including releases with a patch suffix.
  const [, major, minor] = version.split('.')
  const query = `${major}.${minor}`
  const [gophertunnel, CloudburstMC] = await Promise.all([
    getCommitsInRepo('Sandertv/gophertunnel', query, releaseDate),
    getCommitsInRepo('CloudburstMC/Protocol', query, releaseDate)
  ])
  return { gophertunnel, CloudburstMC }
}

function buildIssue (title, release, externalPatches, protocolVersion) {
  let commitData = ''
  const date = new Date(release.currentVersionReleaseDate).toUTCString()

  for (const name in externalPatches) {
    const [patches, diff] = externalPatches[name]
    commitData += `### ${name}\n`
    for (const [message, url] of patches) commitData += `<a href="${url}">${message}</a>\n`
    commitData += diff ? `\n**[See the diff between *${release.currentVersionReleaseDate}* and now](${diff})**\n` : '\n(No changes so far)\n'
  }

  return {
    title,
    body: `
A new Minecraft Bedrock version is available (as of ${date}), version **${release.version}**

## Official Changelog
* ${release.releaseNotes} *(via App Store)*
* ${changelogURL}

## 3rd party protocol patches
${commitData}

## Protocol Details
The latest server PONG reports protocol **${protocolVersion}**.
<table>
  <tr><td><b>Name</b></td><td>${release.version}</td>
  <tr><td><b>Protocol ID</b></td><td>${protocolVersion}</td>
</table>

-----

🤖 I am a bot, I check for updates every 2 hours without a trigger. You can close this issue to prevent further updates.
    `
  }
}

async function getServerPong (version) {
  try {
    const pong = await bedrockServer.getPongDetails(version)
    console.log('Server pong', pong)
    if (pong.protocolVersion === undefined || pong.protocolVersion === null || pong.protocolVersion === '') {
      throw new Error('The server PONG did not include a protocol version')
    }
    console.log('Detected protocol version', pong.protocolVersion)
    return { pong }
  } catch (error) {
    console.error('Failed to detect protocol version', error)
    return { error }
  }
}

async function dispatchMinecraftDataUpdate (version, protocolVersion, issueUrl) {
  const payload = {
    owner: 'PrismarineJS',
    repo: 'minecraft-data',
    workflow: 'bedrock-version-bump.yml',
    branch: 'master',
    inputs: {
      version,
      protocolVersion: String(protocolVersion),
      issueUrl,
      createPr: 'true'
    }
  }
  console.log('Sending workflow dispatch', payload)
  await helper.sendWorkflowDispatch(payload)
}

async function main () {
  const release = await readLatestRelease()
  const version = release.version.startsWith('1.') ? release.version : `1.${release.version}`
  const normalizedRelease = { ...release, version }
  const title = `Support Minecraft ${version}`
  const supportedProtocolVersion = Versions[CURRENT_VERSION]

  if (supportedProtocolVersion === undefined) {
    throw new Error(`Could not find protocol data for CURRENT_VERSION ${CURRENT_VERSION}`)
  }
  console.log('Current supported version', CURRENT_VERSION, 'protocol', supportedProtocolVersion)
  console.log('Latest App Store release', version, release.currentVersionReleaseDate)

  // Exact matches, including closed issues, are already handled.
  const issues = await helper.findIssues({ titleIncludes: title, author: '' })
  if (issues.some(issue => issue.title === title)) {
    console.log(`An issue titled "${title}" already exists.`)
    return
  }

  const { pong, error } = await getServerPong(version)
  if (!error && String(pong.protocolVersion) === String(supportedProtocolVersion)) {
    console.log(`Protocol ${pong.protocolVersion} is already supported.`)
    return
  }

  const protocolVersion = pong?.protocolVersion || '?'
  const issue = await helper.createIssue(buildIssue(
    title,
    normalizedRelease,
    await getProtocolPatches(version, release.currentVersionReleaseDate),
    protocolVersion
  ))

  if (error) {
    await helper.comment(issue.number, `I could not determine the protocol version automatically, so I wasn't able to create a PrismarineJS/minecraft-data PR. The minecraft-data bump workflow must be triggered manually.\n\nError: ${error.message}`)
    return
  }

  try {
    await dispatchMinecraftDataUpdate(version, pong.protocolVersion, issue.url)
  } catch (dispatchError) {
    await helper.comment(issue.number, `I opened the update issue, but failed to open the minecraft-data scaffolding PR automatically. Please retry the workflow dispatch manually.\n\nError: ${dispatchError.message}`)
    throw dispatchError
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}

module.exports = { main, getProtocolPatches, buildIssue }
