const http = require('https')
const fs = require('fs')
const cp = require('child_process')
const debug = require('debug')('minecraft-protocol')
const { getFiles, waitFor } = require('../src/datatypes/util')

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
async function download (os, version, path = 'bds-') {
  process.chdir(__dirname)
  const verStr = version.split('.').slice(0, 3).join('.')
  const dir = path + version

  if (fs.existsSync(dir) && getFiles(dir).length) {
    process.chdir(path + version) // Enter server folder
    return verStr
  }
  try { fs.mkdirSync(dir) } catch { }

  process.chdir(path + version) // Enter server folder
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
  if (process.platform === 'linux') cp.execSync('unzip bds.zip && chmod +777 ./bedrock_server')
  else cp.execSync('tar -xf bds.zip')
  return verStr
}

const defaultOptions = {
  'level-generator': '2',
  'server-port': '19130',
  'online-mode': 'false'
}

// Setup the server
function configure (options = {}) {
  const opts = { ...defaultOptions, ...options }
  let config = fs.readFileSync('./server.properties', 'utf-8')
  config += '\nplayer-idle-timeout=1\nallow-cheats=true\ndefault-player-permission-level=operator'
  for (const o in opts) config += `\n${o}=${opts[o]}`
  fs.writeFileSync('./server.properties', config)
}

function run (inheritStdout = true) {
  const exe = process.platform === 'win32' ? 'bedrock_server.exe' : './bedrock_server'
  return cp.spawn(exe, inheritStdout ? { stdio: 'inherit' } : {})
}

// Run the server
async function startServer (version, onStart, options = {}) {
  const os = process.platform === 'win32' ? 'win' : process.platform
  if (os !== 'win' && os !== 'linux') {
    throw Error('unsupported os ' + os)
  }
  await download(os, version, options.path)
  configure(options)
  const handle = run(!onStart)
  handle.on('error', (...a) => {
    console.warn('*** THE MINECRAFT PROCESS CRASHED ***', a)
    handle.kill('SIGKILL')
  })
  if (onStart) {
    let stdout = ''
    handle.stdout.on('data', data => {
      stdout += data
      if (stdout.includes('Server started')) onStart()
    })
    handle.stdout.pipe(process.stdout)
    handle.stderr.pipe(process.stdout)
  }
  return handle
}

// Start the server and wait for it to be ready, with a timeout
async function startServerAndWait (version, withTimeout, options) {
  let handle
  await waitFor(async res => {
    handle = await startServer(version, res, options)
  }, withTimeout, () => {
    handle?.kill()
    throw new Error('Server did not start on time ' + withTimeout)
  })
  return handle
}

if (!module.parent) {
  // if (process.argv.length < 3) throw Error('Missing version argument')
  startServer(process.argv[2] || '1.16.201', null, process.argv[3] ? { 'server-port': process.argv[3], 'online-mode': !!process.argv[4] } : undefined)
}

module.exports = { fetchLatestStable, startServer, startServerAndWait }
