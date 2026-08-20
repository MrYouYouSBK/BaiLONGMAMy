#!/usr/bin/env node

import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const requestedArch = process.argv[2]
const expectedMachine = requestedArch === 'arm64' ? 'arm64' : requestedArch === 'x64' ? 'x86_64' : null
const oppositeArch = requestedArch === 'arm64' ? 'x64' : 'arm64'
const requireTrustedDistribution = process.env.GAI_REQUIRE_MAC_SIGNING === 'true'

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

function waitForExit(process, timeoutMs) {
  if (!process || process.exitCode !== null) return Promise.resolve(true)
  return new Promise(resolve => {
    let timer
    const finish = exited => {
      clearTimeout(timer)
      process.off('exit', onExit)
      resolve(exited)
    }
    const onExit = () => finish(true)
    process.once('exit', onExit)
    timer = setTimeout(() => finish(process.exitCode !== null), timeoutMs)
  })
}

async function stopChild(process) {
  if (!process || process.exitCode !== null) return
  process.kill('SIGTERM')
  if (await waitForExit(process, 5000)) return
  process.kill('SIGKILL')
  await waitForExit(process, 5000)
}

function assertTrustedApp(appRoot) {
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appRoot])
  const details = spawnSync('/usr/bin/codesign', ['-dvvv', appRoot], { encoding: 'utf8' })
  if (details.status !== 0) fail(`could not inspect Developer ID signature:\n${details.stderr || details.stdout}`)
  const signature = `${details.stdout || ''}\n${details.stderr || ''}`
  if (!/Authority=Developer ID Application:/.test(signature)) fail(`app is not signed with Developer ID Application:\n${signature}`)
  if (!/TeamIdentifier=(?!not set)\S+/.test(signature)) fail(`app signature has no Apple TeamIdentifier:\n${signature}`)
  run('/usr/bin/xcrun', ['stapler', 'validate', appRoot])
  run('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=4', appRoot])

  const quarantineRoot = mkdtempSync(join(tmpdir(), `gai-ai-quarantine-${requestedArch}-`))
  const quarantinedApp = join(quarantineRoot, 'GAI AI.app')
  try {
    run('/usr/bin/ditto', [appRoot, quarantinedApp])
    run('/usr/bin/xattr', ['-w', 'com.apple.quarantine', `0083;${Math.floor(Date.now() / 1000).toString(16)};Safari;`, quarantinedApp])
    run('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=4', quarantinedApp])
  } finally {
    rmSync(quarantineRoot, { recursive: true, force: true })
  }
  console.log('[verify:mac] Developer ID, notarization ticket, Gatekeeper and Safari-quarantine assessment passed')
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
if (requireTrustedDistribution) run('/usr/bin/xcrun', ['stapler', 'validate', dmgPath])
const mountDir = mkdtempSync(join(tmpdir(), `gai-ai-${requestedArch}-`))
let mounted = false
let child
let smokeRoot

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
  if (requireTrustedDistribution) assertTrustedApp(appRoot)
  else console.log('[verify:mac] unsigned PR smoke mode; release publishing is disabled for this artifact')

  smokeRoot = mkdtempSync(join(tmpdir(), 'gai-ai-smoke-'))
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
  await stopChild(child)
  child = undefined
  rmSync(smokeRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  smokeRoot = undefined
} finally {
  await stopChild(child)
  if (smokeRoot) rmSync(smokeRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  if (mounted) spawnSync('hdiutil', ['detach', mountDir, '-force'], { stdio: 'ignore' })
  rmSync(mountDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
}
