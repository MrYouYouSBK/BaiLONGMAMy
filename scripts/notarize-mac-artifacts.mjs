#!/usr/bin/env node

import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const arch = process.argv[2]
if (!['arm64', 'x64'].includes(arch)) {
  console.error('[notarize:mac] usage: node scripts/notarize-mac-artifacts.mjs <arm64|x64>')
  process.exit(2)
}

const credentials = {
  key: String(process.env.APPLE_API_KEY || '').trim(),
  keyId: String(process.env.APPLE_API_KEY_ID || '').trim(),
  issuer: String(process.env.APPLE_API_ISSUER || '').trim(),
}
const missing = Object.entries(credentials).filter(([, value]) => !value).map(([name]) => name)
if (missing.length > 0) throw new Error(`[notarize:mac] missing Apple notary credentials: ${missing.join(', ')}`)

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.status !== 0) {
    throw new Error(`[notarize:mac] ${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout || 'unknown error'}`)
  }
  return String(result.stdout || '').trim()
}

function singleArtifact(suffix) {
  const matches = readdirSync('dist').filter(name => name.startsWith('GAI-AI-') && name.endsWith(suffix))
  if (matches.length !== 1) throw new Error(`[notarize:mac] expected one *${suffix}, found: ${matches.join(', ') || 'none'}`)
  return join(process.cwd(), 'dist', matches[0])
}

function findApp(root, depth = 0) {
  if (depth > 4) return null
  const entries = readdirSync(root, { withFileTypes: true })
  const direct = entries.find(entry => entry.isDirectory() && entry.name === 'GAI AI.app')
  if (direct) return join(root, direct.name)
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.endsWith('.app')) continue
    const found = findApp(join(root, entry.name), depth + 1)
    if (found) return found
  }
  return null
}

const zipPath = singleArtifact(`-mac-${arch}.zip`)
const dmgPath = singleArtifact(`-mac-${arch}.dmg`)
const extracted = mkdtempSync(join(tmpdir(), `gai-ai-notary-${arch}-`))

try {
  run('/usr/bin/ditto', ['-x', '-k', zipPath, extracted])
  const appPath = findApp(extracted)
  if (!appPath) throw new Error('[notarize:mac] update ZIP does not contain GAI AI.app')

  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath])
  run('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath])
  run('/usr/bin/xcrun', ['stapler', 'validate', appPath])

  const submission = run('/usr/bin/xcrun', [
    'notarytool', 'submit', dmgPath,
    '--key', credentials.key,
    '--key-id', credentials.keyId,
    '--issuer', credentials.issuer,
    '--wait', '--output-format', 'json',
  ])
  const result = JSON.parse(submission)
  if (result.status !== 'Accepted') {
    throw new Error(`[notarize:mac] Apple rejected ${dmgPath}: ${submission}`)
  }

  run('/usr/bin/xcrun', ['stapler', 'staple', dmgPath])
  run('/usr/bin/xcrun', ['stapler', 'validate', dmgPath])
  console.log(`[notarize:mac] signed app and stapled DMG accepted for ${arch}; submission ${result.id || 'complete'}`)
} finally {
  rmSync(extracted, { recursive: true, force: true })
}
