import fs from 'node:fs'
import path from 'node:path'

import { loadProjectConfig } from '../../utils/config'
import { logger } from '../../utils/logger'
import { collectSourceFiles, loadAliasEntries, type AliasEntry } from '../check/index'

export function moveCommand(
  sourceSlice: string,
  targetSlice: string,
  options: { dryRun?: boolean },
) {
  // slice strings should be converted to posix
  const srcSlice = sourceSlice.replace(/\\/g, '/')
  const tgtSlice = targetSlice.replace(/\\/g, '/')

  const config = loadProjectConfig()
  const srcPath = path.join(process.cwd(), config.srcDir)

  const sourceFull = path.join(srcPath, ...srcSlice.split('/'))
  const targetFull = path.join(srcPath, ...tgtSlice.split('/'))

  if (!fs.existsSync(sourceFull)) {
    logger.error(`Source slice "${srcSlice}" does not exist at ${sourceFull}`)
    process.exit(1)
  }

  if (fs.existsSync(targetFull)) {
    logger.error(`Target slice "${tgtSlice}" already exists at ${targetFull}`)
    process.exit(1)
  }

  logger.info(`Preparing to move ${srcSlice} -> ${tgtSlice}`)

  const aliases = loadAliasEntries(process.cwd(), config.srcDir)

  const files = collectSourceFiles(srcPath)
  let updatedFilesCount = 0
  let totalReplaced = 0

  const IMPORT_RE = /^(\s*(?:import|export)\s+(?:[^'"]*\s+from\s+)?['"])([^'"]+)(['"])/gm

  for (const relFile of files) {
    const posixRelFile = relFile.split(path.sep).join('/')
    const isFileInSourceSlice = posixRelFile.startsWith(srcSlice + '/') || posixRelFile === srcSlice
    const filePath = path.join(srcPath, relFile)
    const fileTargetBaseDir = isFileInSourceSlice
      ? path.dirname(
          path.join(
            srcPath,
            ...tgtSlice.split('/'),
            ...posixRelFile.slice(srcSlice.length + 1).split('/'),
          ),
        )
      : path.dirname(filePath)

    const content = fs.readFileSync(filePath, 'utf8')

    let fileChanged = false
    const newContent = content.replace(IMPORT_RE, (match, prefix, importPath, suffix) => {
      let resolvedAliased: string | null = null
      let matchingAlias: AliasEntry | null = null

      for (const a of aliases) {
        if (importPath.startsWith(a.prefix)) {
          resolvedAliased = a.target + importPath.slice(a.prefix.length)
          matchingAlias = a
          break
        }
      }

      let newImportPath = importPath

      if (resolvedAliased && matchingAlias) {
        const resolvedPosix = resolvedAliased.split(path.sep).join('/')
        // 1. Is it pointing to the source slice?
        if (resolvedPosix === srcSlice || resolvedPosix.startsWith(srcSlice + '/')) {
          const relativeToSlice = resolvedPosix.slice(srcSlice.length)
          const newResolved = tgtSlice + relativeToSlice
          if (newResolved.startsWith(matchingAlias.target)) {
            newImportPath = matchingAlias.prefix + newResolved.slice(matchingAlias.target.length)
          }
        }
      } else if (importPath.startsWith('.')) {
        // Resolving relative import based on CURRENT file location
        const fileBaseDir = path.dirname(filePath)
        const resolvedAbs = path.resolve(fileBaseDir, importPath)
        const relToSrcPaths = path.relative(srcPath, resolvedAbs).split(path.sep).join('/')

        const isImportingSourceSlice =
          relToSrcPaths === srcSlice || relToSrcPaths.startsWith(srcSlice + '/')
        const isImportingOutside =
          !isImportingSourceSlice && !relToSrcPaths.startsWith(srcSlice + '/')

        if (!isFileInSourceSlice && isImportingSourceSlice) {
          // File outside imports from inside moved slice
          const relativeInside = relToSrcPaths.slice(srcSlice.length)
          const newAbsoluteTarget = path.join(
            srcPath,
            ...tgtSlice.split('/'),
            ...relativeInside.split('/'),
          )
          let newRel = path.relative(fileBaseDir, newAbsoluteTarget).split(path.sep).join('/')
          if (!newRel.startsWith('.')) newRel = './' + newRel
          newImportPath = newRel
        } else if (isFileInSourceSlice && isImportingOutside) {
          // File inside moved slice imports from outside
          // Since the file itself is moving to fileTargetBaseDir, we must calculate the new relative path
          // from fileTargetBaseDir's directory to the original resolvedAbs
          let newRel = path.relative(fileTargetBaseDir, resolvedAbs).split(path.sep).join('/')
          if (!newRel.startsWith('.')) newRel = './' + newRel
          newImportPath = newRel
        }
      }

      if (newImportPath !== importPath) {
        fileChanged = true
        totalReplaced++
        return `${prefix}${newImportPath}${suffix}`
      }

      return match
    })

    if (fileChanged) {
      if (!options.dryRun) {
        fs.writeFileSync(filePath, newContent, 'utf8')
      }
      updatedFilesCount++
    }
  }

  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(targetFull), { recursive: true })
    fs.renameSync(sourceFull, targetFull)
    logger.success(`✓ Moved ${srcSlice} -> ${tgtSlice}`)
    logger.success(`✓ Updated ${totalReplaced} imports in ${updatedFilesCount} files`)
  } else {
    logger.success(`(Dry Run) Would move ${srcSlice} -> ${tgtSlice}`)
    logger.success(`(Dry Run) Would update ${totalReplaced} imports in ${updatedFilesCount} files`)
  }
}
