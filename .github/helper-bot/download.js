const htmlURL = 'https://www.minecraft.net/en-us/download/server/bedrock'

async function getLatestVersions () {
  const html = await fetch(htmlURL).then(res => res.text())
  // Find '                                        <a href="https://minecraft.azureedge.net/bin-linux/bedrock-server-1.20.72.01.zip" aria-label="Download Minecraft Dedicated Server software for Ubuntu (Linux)" class="btn btn-disabled-outline mt-4 downloadlink" role="button" data-platform="serverBedrockLinux" tabindex="0" aria-disabled="true">Download </a>'
  const links = [...html.matchAll(/a href="(.*?)" /g)].map(match => match[1])

  function forOS (os) {
    const url = links.find(link => link.includes(os + '/'))
    if (!url) return null
    const version4 = url.match(/bedrock-server-(\d+\.\d+\.\d+\.\d+)\.zip/)[1]
    const version3 = version4.split('.').slice(0, 3).join('.')
    return { version4, version3, url }
  }

  return {
    linux: forOS('linux'),
    windows: forOS('win'),
    macos: forOS('osx'),
    preview: {
      linux: forOS('linux-preview'),
      windows: forOS('win-preview'),
      macos: forOS('osx-preview')
    }
  }
}

getLatestVersions().then(console.log).catch(console.error)