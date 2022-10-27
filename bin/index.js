#! /usr/bin/env node

const yargs = require('yargs')
const StreamZip = require('node-stream-zip')
const fs = require('fs')
const chalk = require('chalk')
const { CheckUpdates } = require('./utils')
const FetchErrors = require('../Functions/FetchErrors')
const axios = require('axios').default

const Usage =
  '\nUsage: changelog-generator <path/to/old.mrpack> <path/to/new.mrpack>'

yargs.usage(Usage).help(true)

const Main = async () => {
  await CheckUpdates()

  FirstArgument = yargs.argv._[0]
  SecondArgument = yargs.argv._[1]

  FetchErrors(yargs.argv._)

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

  let changed = []
  let added = []
  let removed = []

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

        changed.push({
          project,
          versions: {
            old: OldVesrion.version_number,
            new: NewVersion.version_number,
          },
        })
      } else if (
        !NewFiles.find(
          (object) => JSON.stringify(object) === JSON.stringify(file)
        )
      ) {
        const project = (
          await axios.get(`https://api.modrinth.com/v2/project/${id}`)
        ).data

        removed.push({ project })
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

        added.push({ project })
      }
    })
  )

  let context = ''

  changed.sort((a, b) => a.project.title.localeCompare(b.project.title))

  added.sort((a, b) => a.project.title.localeCompare(b.project.title))

  removed.sort((a, b) => a.project.title.localeCompare(b.project.title))

  if (added.length > 0) {
    context += `*Added:*  \n${added
      .map(
        (object) =>
          `* [${object.project.title}](https://modrinth.com/mod/${object.project.slug})  `
      )
      .join('\n')}  \n`
  }

  if (changed.length > 0) {
    context += `*Changed:*  \n${changed
      .map(
        (object) =>
          `* [${object.project.title}](https://modrinth.com/mod/${object.project.slug}): ${object.versions.old.version_number} -> ${object.versions.new.version_number}  `
      )
      .join('\n')}  \n`
  }

  if (removed.length > 0) {
    context += `*Removed:*  \n${removed
      .map(
        (object) =>
          `* [${object.project.title}](https://modrinth.com/mod/${object.project.slug})  `
      )
      .join('\n')}`
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

Main()
