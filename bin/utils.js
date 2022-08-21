const { default: axios } = require('axios')
const PackageJson = require('../package.json')
const chalk = require('chalk')
const usage =
  '\nUsage: changelog-generator <path/to/old.mrpack> <path/to/new.mrpack>'
module.exports = { ShowHelp, CheckUpdates }

function ShowHelp() {
  console.log(usage)
  console.log('\nOptions:\r')
  console.log('\t--help\t\t      ' + 'Show help.' + '\t\t\t' + '[boolean]\n')
}

async function CheckUpdates() {
  const package = (
    await axios.get(
      'https://registry.npmjs.com/-/v1/search?text=minecraft-changelog-generator'
    )
  ).data.objects[0].package

  if (!package?.version) return

  const PackageVersion = PackageJson.version

  if (package.version > PackageVersion) {
    console.log(
      chalk.green(
        `A new version is out - ${package.version}\nUpdate: `,
        chalk.blue('npm update --global minecraft-changelog-generator')
      )
    )
  }
}
