const chalk = require('chalk')
const usage =
  '\nUsage: changelog-generator <path/to/old.mrpack> <path/to/new.mrpack>'
module.exports = { ShowHelp }

function ShowHelp() {
  console.log(usage)
  console.log('\nOptions:\r')
  console.log('\t--help\t\t      ' + 'Show help.' + '\t\t\t' + '[boolean]\n')
}
