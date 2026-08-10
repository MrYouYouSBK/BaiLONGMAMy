#!/usr/bin/env node

import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const requestedArch = process.argv[2]
const expectedMachine = requestedArch === 'arm64' ? 'arm64' : requestedArch === 'x64' ? 'x86_64' : null
const oppositeArch = requestedArch === 'arm64' ? 'x64' : 'arm64'

if (!expectedMachine) {
  console.error('[verify:mac] usage: node scripts/verify-mac-build.mjs <arm64|x64>')
  process.exit(2)
}

function fail(message) {
  throw new Error(`[verify:mac] ${message}`)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout || 'unknown error'}`)
  }
  return result.stdout.trim()
}

function assertMachine(filePath, label) {
  const description = run('file', ['-b', filePath])
  if (!description.includes(expectedMachine)) {
    fail(`${label} is not ${requestedArch}: ${description}`)
  }
  console.log(`[verify:mac] ${label}: ${description}`)
}

const distFiles = readdirSync('dist')
const expectedPrefix = 'GAI-AI-'
const expectedSuffixes = [`-mac-${requestedArch}.dmg`, `-mac-${requestedArch}.zip`]
const oppositeFiles = distFiles.filter(name =>
  name.startsWith(expectedPrefix) && name.includes(`-mac-${oppositeArch}.`)
)
if (oppositeFiles.length > 0) {
  fail(`cross-architecture output leaked into ${requestedArch} job: ${oppositeFiles.join(', ')}`)
}

for (const suffix of expectedSuffixes) {
  const matches = distFiles.filter(name => name.startsWith(expectedPrefix) && name.endsWith(suffix))
  if (matches.length !== 1) {
    fail(`expected exactly one *${suffix}; found ${matches.length}: ${matches.join(', ')}`)
  }
}

const dmgName = distFiles.find(name => name.startsWith(expectedPrefix) && name.endsWith(`-mac-${requestedArch}.dmg`))
const dmgPath = join(process.cwd(), 'dist', dmgName)
const mountDir = mkdtempSync(join(tmpdir(), `gai-ai-${requestedArch}-`))
let mounted = false
let child

try {
  run('hdiutil', ['attach', dmgPath, '-nobrowse', '-readonly', '-mountpoint', mountDir])
  mounted = true

  const appName = readdirSync(mountDir).find(name => name.endsWith('.app'))
  if (!appName) fail(`no .app bundle found in ${basename(dmgPath)}`)

  const appRoot = join(mountDir, appName)
  const executable = join(appRoot, 'Contents', 'MacOS', 'GAI AI')
  const resources = join(appRoot, 'Contents', 'Resources')
  const sqliteBinding = join(resources, 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
  const speechHelper = join(resources, 'app.asar.unpacked', 'build', 'native-speech-recognizer')

  assertMachine(executable, 'Electron executable')
  assertMachine(sqliteBinding, 'better-sqlite3 binding')
  assertMachine(speechHelper, 'native speech helper')

  const smokeRoot = mkdtempSync(join(tmpdir(), 'gai-ai-smoke-'))
  child = spawn(executable, [], {
    env: {
      ...process.env,
      BAILONGMA_PORTABLE_DIR: smokeRoot,
      ELECTRON_ENABLE_LOGGING: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stderr = ''
  child.stderr.on('data', chunk => { stderr += chunk.toString() })

  const outcome = await new Promise(resolve => {
    const timer = setTimeout(() => resolve({ alive: child.exitCode === null }), 15000)
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      resolve({ alive: false, code, signal })
    })
  })

  if (!outcome.alive) {
    fail(`packaged app exited during launch smoke test (code=${outcome.code}, signal=${outcome.signal}):\n${stderr.slice(-4000)}`)
  }

  console.log('[verify:mac] packaged app remained alive for 15 seconds')
  child.kill('SIGTERM')
  rmSync(smokeRoot, { recursive: true, force: true })
} finally {
  if (child && child.exitCode === null) child.kill('SIGKILL')
  if (mounted) spawnSync('hdiutil', ['detach', mountDir, '-force'], { stdio: 'ignore' })
  rmSync(mountDir, { recursive: true, force: true })
}
