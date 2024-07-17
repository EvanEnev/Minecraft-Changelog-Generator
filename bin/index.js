#! /usr/bin/env node

const yargs = require('yargs')
const StreamZip = require('node-stream-zip')
const fs = require('fs')
const chalk = require('chalk')
const { CheckUpdates } = require('./utils')
const fetchErrors = require('../functions/fetchErrors')
const axios = require('axios').default

  const Usage =
    '\nUsage: changelog-generator <path/to/old.mrpack> <path/to/new.mrpack>'

yargs.usage(Usage).help(true)

const Main = async () => {
  await CheckUpdates()

  const firstArgument = yargs.argv._[0]
  const secondArgument = yargs.argv._[1]

  const message = fetchErrors(yargs.argv._)

  if (message) {
    return console.log(message)
  }

  const firstFile = new StreamZip.async({
    file: firstArgument,
    storeEntries: true,
  })

  const secondFile = new StreamZip.async({
    file: secondArgument,
    storeEntries: true,
  })

  const oldStream = await firstFile.stream('modrinth.index.json')
  const newStream = await secondFile.stream('modrinth.index.json')

  const FirstResult = await StreamToString(oldStream, firstFile)
  const SecondResult = await StreamToString(newStream, secondFile)

  const OldJson = JSON.parse(FirstResult)
  const NewJson = JSON.parse(SecondResult)

  const oldFiles = OldJson?.files
  const newFiles = NewJson?.files

  let changed = []
  let added = []
  let removed = []

  const base62Regexp = new RegExp('^[a-zA-Z0-9]{1,}$')

  const GetId = (file) => {
    const splitted = file.downloads[0].slice(30).split('/')

    return {
      project: splitted[0],
      version: splitted[2],
      valid: base62Regexp.test(splitted[2]),
    }
  }

  const getProjects = async (ids) => 
     (await axios.get(`https://api.modrinth.com/v2/projects?ids=${JSON.stringify(ids)}`).catch(e => console.error(e)))?.data
  const getVersions = async (ids) => 
     (await axios.get(`https://api.modrinth.com/v2/versions?ids=${JSON.stringify(ids)}`).catch(e => console.error(e)))?.data

  const oldProjectIds = oldFiles.map(file => GetId(file).project)
  const newProjectIds = newFiles.map(file => GetId(file).project)

  const getVersion = (file) => {
    const ids = GetId(file)
    return ids.valid ? ids.version : ''
  }

  const oldProjectVersions = oldFiles.map(getVersion)
  const newProjectVersions = newFiles.map(getVersion)

  const oldProjects = await getProjects(oldProjectIds)
  const newProjects = await getProjects(newProjectIds)

  const oldVersions = await getVersions(oldProjectVersions)
  const newVersions = await getVersions(newProjectVersions)

  await Promise.all(
    oldProjects?.map(async (project) => {
      const { id } = project

      const versions = {
        old: oldVersions?.flat()?.filter((version) =>
          version?.project_id === id
        ),
        new: newVersions?.flat()?.filter((version) =>
          version?.project_id === id
        ),
      }

      const oldVersion = versions.old[0]
      const newVersion = versions.new[0]

      if (newVersion && oldVersion.id !== newVersion.id
      ) {
        changed.push({
          project,
          versions: {
            old: oldVersion.version_number,
            new: newVersion.version_number,
          },
        })
      } else if (
        !newFiles.find(
          (object) => object.id === id
        )
      ) {
        removed.push({ project })
      }
    })
  )

  await Promise.all(
    newProjects?.map(async (project) => {
      const { id } = project

      if (
        !oldProjects.find(
          (object) => object.id === id
        ) && !changed.find(
          (object) => object.project.id === id
        )
      ) {
        added.push({ project })
      }
    })
  )

  let context = ''

  changed.sort((a, b) => a.project.title.localeCompare(b.project.title))

  added.sort((a, b) => a.project.title.localeCompare(b.project.title))

  removed.sort((a, b) => a.project.title.localeCompare(b.project.title))

  if (added.length > 0) {
    context += `*Added (${added.length}):*  \n${added
      .map(
        (object) =>
          `* [${object.project.title}](https://modrinth.com/mod/${object.project.slug})  `
      )
      .join('\n')}  \n`
  }

  if (changed.length > 0) {
    context += `*Changed (${changed.length}):*  \n${changed
      .map(
        (object) =>
          `* [${object.project.title}](https://modrinth.com/mod/${object.project.slug}): ${object.versions.old} -> ${object.versions.new}  `
      )
      .join('\n')}  \n`
  }

  if (removed.length > 0) {
    context += `*Removed (${removed.length}):*  \n${removed
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
