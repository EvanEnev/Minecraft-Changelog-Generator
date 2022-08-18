#! /usr/bin/env node

const yargs = require('yargs')
const StreamZip = require('node-stream-zip')
const fs = require('fs')
const chalk = require('chalk')
const axios = require('axios').default

const usage =
  '\nUsage: changelog-generator <path/to/old.mrpack> <path/to/new.mrpack>'

yargs.usage(usage).help(true)

const main = async () => {
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

  const FirstFile = new StreamZip({ file: FirstArgument, storeEntries: true })
  const SecondFile = new StreamZip({ file: SecondArgument, storeEntries: true })

  // Thanks to https://github.com/Brawaru

  const {
    promise: FirstResultPromise,
    resolve: FirstAcceptResult,
    reject: FirstErrorResult,
  } = defer()

  FirstFile.on('ready', () => {
    const IndexEntry = FirstFile.entry('modrinth.index.json')
    if (IndexEntry == null) {
      errorResult(new Error('Modrinth index file not found'))
      return
    }

    FirstFile.stream(IndexEntry, (err, stream) => {
      if (err != null) {
        FirstErrorResult(err)
        return
      }

      StreamToString(stream, FirstFile).then(
        FirstAcceptResult,
        FirstErrorResult
      )
    })
  })

  const {
    promise: SecondResultPromise,
    resolve: SecondAcceptResult,
    reject: SecondErrorResult,
  } = defer()

  SecondFile.on('ready', () => {
    const IndexEntry = SecondFile.entry('modrinth.index.json')
    if (IndexEntry == null) {
      errorResult(new Error('Modrinth index file not found'))
      return
    }

    SecondFile.stream(IndexEntry, (err, stream) => {
      if (err != null) {
        SecondErrorResult(err)
        return
      }

      StreamToString(stream, SecondFile).then(
        SecondAcceptResult,
        SecondErrorResult
      )
    })
  })

  const FirstResult = await FirstResultPromise.finally(() => FirstFile.close())
  const SecondResult = await SecondResultPromise.finally(() =>
    SecondFile.close()
  )

  const OldJson = JSON.parse(FirstResult)
  const NewJson = JSON.parse(SecondResult)

  const OldFiles = OldJson?.files
  const NewFiles = NewJson?.files

  let changed = ''
  let added = ''
  let removed = ''

  await Promise.all(
    OldFiles?.map(async (file, index) => {
      const id = file.downloads[0].slice(30).split('/')[0]

      if (
        NewFiles.find(
          (object) => JSON.stringify(object) === JSON.stringify(file)
        )
      ) {
        return
      } else if (
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
    }),

    NewFiles?.map(async (file) => {
      const id = file.downloads[0].slice(30).split('/')[0]

      if (
        OldFiles.find(
          (object) => JSON.stringify(object) === JSON.stringify(file)
        )
      ) {
        return
      } else if (
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

  fs.writeFileSync(
    'changelog.md',
    `*Added:*  \n${added}  \n*Changed:*  \n${changed}  \n*Removed:*  \n${removed}`
  )

  function StreamToString(stream) {
    const chunks = []
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      stream.on('error', (err) => reject(err))
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
  }

  function defer() {
    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

main()
