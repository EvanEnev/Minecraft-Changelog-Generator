const fs = require('fs')

module.exports = (args) => {
  if (
    !(
      FirstArgument &&
      FirstArgument?.endsWith('.mrpack') &&
      fs.existsSync(FirstArgument)
    )
  ) {
    return console.log(
      chalk.red('\nYou should provide a valid path to old .mrpack file')
    )
  }

  if (
    !(
      SecondArgument &&
      SecondArgument?.endsWith('.mrpack') &&
      fs.existsSync(SecondArgument)
    )
  ) {
    return console.log(
      chalk.red('\nYou should provide a valid path to new .mrpack file')
    )
  }
}
