const http = require('https')
const fs = require('fs')
const cp = require('child_process')
const debug = require('debug')('minecraft-protocol')
const { getFiles } = require('../src/datatypes/util')

const head = (url) => new Promise((resolve, reject) => http.request(url, { method: 'HEAD' }, resolve).on('error', reject).end())
const get = (url, out) => cp.execSync(`curl -o ${out} ${url}`)

// Get the latest versions
// TODO: once we support multi-versions
function fetchLatestStable () {
  get('https://raw.githubusercontent.com/minecraft-linux/mcpelauncher-versiondb/master/versions.json', 'versions.json')
  const versions = JSON.parse(fs.readFileSync('./versions.json'))
  const latest = versions[versions.length - 1]
  return latest.version_name
}

// Download + extract vanilla server and enter the directory
async function download (os, version) {
  process.chdir(__dirname)
  const verStr = version.split('.').slice(0, 3).join('.')
  const dir = 'bds-' + version

  if (fs.existsSync(dir) && getFiles(dir).length) {
    process.chdir('bds-' + version) // Enter server folder
    return verStr
  }
  try { fs.mkdirSync(dir) } catch { }

  process.chdir('bds-' + version) // Enter server folder
  const url = (os, version) => `https://minecraft.azureedge.net/bin-${os}/bedrock-server-${version}.zip`

  let found = false

  for (let i = 0; i < 8; i++) { // Check for the latest server build for version (major.minor.patch.BUILD)
    const u = url(os, `${verStr}.${String(i).padStart(2, '0')}`)
    debug('Opening', u)
    const ret = await head(u)
    if (ret.statusCode === 200) {
      found = u
      debug('Found server', ret.statusCode)
      break
    }
  }
  if (!found) throw Error('did not find server bin for ' + os + ' ' + version)
  console.info('🔻 Downloading', found)
  get(found, 'bds.zip')
  console.info('⚡ Unzipping')
  // Unzip server
  if (process.platform === 'linux') cp.execSync('unzip bds.zip')
  else cp.execSync('tar -xf bds.zip')
  return verStr
}

// Setup the server
function configure () {
  let config = fs.readFileSync('./server.properties', 'utf-8')
  config += '\nlevel-generator=2\nserver-port=19130\nplayer-idle-timeout=1\nallow-cheats=true\ndefault-player-permission-level=operator'
  fs.writeFileSync('./server.properties', config)
}

async function run () {
  if (process.platform === 'win32') return cp.spawnSync('bedrock_server.exe', { stdio: 'inherit' })
  else cp.spawnSync('./bedrock_server', { stdio: 'inherit' })
}

// Run the server
async function main (version) {
  const os = process.platform === 'win32' ? 'win' : process.platform
  if (os !== 'win' && os !== 'linux') {
    throw Error('unsupported os ' + os)
  }
  await download(os, version)
  configure()
  run()
}

// async function main () {
//   fs.remov
//   // const latest_version = fetchLatestStable()
//   const { Versions } = require('../src/options')

//   for (const version in Versions) {
//     download('win', version)
//   }
// }

// download('linux', '')

function startServer (version, seperateProcess = true) {
  if (seperateProcess) {
    const handle = cp.spawn('node', ('startVanillaServer.js ' + version).split(' '), { stdio: 'inherit' })
    return handle
  } else {
    main(process.argv[2]) // No way to un-block, just for testing
  }
}

if (!module.parent) {
  // if (process.argv.length < 3) throw Error('Missing version argument')
  main(process.argv[2] || '1.16.201')
}

module.exports = { fetchLatestStable, startServer }
