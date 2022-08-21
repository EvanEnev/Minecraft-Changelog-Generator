#! /usr/bin/env node

const yargs = require('yargs')
const StreamZip = require('node-stream-zip')
const fs = require('fs')
const chalk = require('chalk')
const { CheckUpdates } = require('./utils')
const axios = require('axios').default

const Usage =
  '\nUsage: changelog-generator <path/to/old.mrpack> <path/to/new.mrpack>'

yargs.usage(Usage).help(true)

const main = async () => {
  await CheckUpdates()

  FirstArgument = yargs.argv._[0]
  SecondArgument = yargs.argv._[1]

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

  const FirstFile = new StreamZip.async({
    file: FirstArgument,
    storeEntries: true,
  })
  const SecondFile = new StreamZip.async({
    file: SecondArgument,
    storeEntries: true,
  })

  const OldStream = await FirstFile.stream('modrinth.index.json')
  const NewStream = await SecondFile.stream('modrinth.index.json')

  const FirstResult = await StreamToString(OldStream, FirstFile)
  const SecondResult = await StreamToString(NewStream, SecondFile)

  const OldJson = JSON.parse(FirstResult)
  const NewJson = JSON.parse(SecondResult)

  const OldFiles = OldJson?.files
  const NewFiles = NewJson?.files

  let changed = ''
  let added = ''
  let removed = ''

  const GetId = (file) => file.downloads[0].slice(30).split('/')[0]

  await Promise.all(
    OldFiles?.map(async (file) => {
      const id = GetId(file)

      if (
        NewFiles.find(
          (object) =>
            object.downloads[0].includes(id) &&
            JSON.stringify(object) != JSON.stringify(file)
        )
      ) {
        const project = (
          await axios.get(`https://api.modrinth.com/v2/project/${id}`)
        ).data

        const NewFile = NewFiles.find(
          (object) =>
            object.downloads[0].includes(id) &&
            JSON.stringify(object) != JSON.stringify(file)
        )

        const versions = (
          await axios.get(`https://api.modrinth.com/v2/project/${id}/version`)
        ).data

        const OldVesrion = versions.find((object) =>
          object.files.find(
            (VersionFile) => file.downloads[0] === VersionFile.url
          )
        )

        const NewVersion = versions.find((object) =>
          object.files.find(
            (VersionFile) => NewFile.downloads[0] === VersionFile.url
          )
        )

        changed += `* [${project.title}](https://modrinth.com/mod/${project.slug}): ${OldVesrion.version_number} -> ${NewVersion.version_number}  \n`
      } else if (
        !NewFiles.find(
          (object) => JSON.stringify(object) === JSON.stringify(file)
        )
      ) {
        const project = (
          await axios.get(`https://api.modrinth.com/v2/project/${id}`)
        ).data

        removed += `* [${project.title}](https://modrinth.com/mod/${project.slug})  \n`
      }
    })
  )

  await Promise.all(
    NewFiles?.map(async (file) => {
      const id = GetId(file)

      if (
        !OldFiles.find(
          (object) => JSON.stringify(object) === JSON.stringify(file)
        )
      ) {
        const project = (
          await axios.get(`https://api.modrinth.com/v2/project/${id}`)
        ).data

        added += `* [${project.title}](https://modrinth.com/mod/${project.slug})  \n`
      }
    })
  )

  let context = ''

  if (added.length > 0) {
    context += `*Added:*  \n${added}  \n`
  }

  if (changed.length > 0) {
    context += `*Changed:*  \n${changed}  \n`
  }

  if (removed.length > 0) {
    context += `*Removed:*  \n${removed}`
  }

  if (context.length == 0) {
    return console.log(chalk.red('No changes foung'))
  }

  fs.writeFile('changelog.md', context, () => {
    console.log(chalk.green('The changelog.md has been saved'))
  })

  function StreamToString(stream, file) {
    const chunks = []
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      stream.on('error', (err) => reject(err))
      stream.on('end', () => {
        file.close()
        return resolve(Buffer.concat(chunks).toString('utf8'))
      })
    })
  }
}

main()
