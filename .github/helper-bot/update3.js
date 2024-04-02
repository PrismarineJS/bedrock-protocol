const fs = require('fs')
const github = require('gh-helpers')()

async function main () {
  const stages = ['stage1.txt', 'stage2.txt', 'stage3.txt', 'stage4.txt']
  const allStages = fs.createWriteStream('merged.txt')
  for (const stage of stages) {
    allStages.write(fs.readFileSync(stage, 'latin1'))
  }
  allStages.end()
  const artifact = await github.artifacts.createTextArtifact('updatorData', {
    extracted: fs.readFileSync('merged.txt', 'latin1'),
    collected: JSON.stringify(require('./collected.json'))
  })
  console.log('Created artifact', artifact)
  const dispatch = await github.sendWorkflowDispatch({
    repo: 'llm-services',
    workflow: 'dispatch.yml',
    branch: 'main',
    inputs: {
      repoData: await github.getRepoDetails(),
      artifactId: artifact.id,
      artifactSize: artifact.size,
      updateVersion: process.env.UPDATE_VERSION,
      serverVersion: process.env.SERVER_VERSION,
      protocolVersion: process.env.PROTOCOL_VERSION,
      issueNo: process.env.ISSUE_NUMBER
    }
  })
  console.log('Sent workflow dispatch', dispatch)
}

main()
