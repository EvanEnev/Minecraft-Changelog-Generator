const fs = require('fs')
const chalk = require('chalk')

module.exports = (args) => {
  if (
    !(
      args[0]?.endsWith('.mrpack') &&
      fs.existsSync(args[0])
    )
  ) {
      return chalk.red('\nYou should provide a valid path to old .mrpack file')
    
  }

  if (
    !(
      args[1]?.endsWith('.mrpack') &&
      fs.existsSync(args[1])
    )
  ) {
    return chalk.red('\nYou should provide a valid path to new .mrpack file')
  }

  return false
}
