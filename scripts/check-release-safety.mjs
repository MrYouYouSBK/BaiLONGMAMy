#!/usr/bin/env node

import { execFileSync } from 'node:child_process'

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

const forbidden = tracked.filter((file) => {
  const normalized = file.replaceAll('\\', '/')
  const base = normalized.split('/').at(-1)

  if (normalized === 'config.json' || normalized === 'seedance.json') return true
  if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) return true
  if (/^(llm|tts)\//.test(normalized)) return true
  return false
})

if (forbidden.length > 0) {
  console.error('[release-safety] Refusing to build with tracked credential files:')
  for (const file of forbidden) console.error(`- ${file}`)
  process.exit(1)
}

console.log(`[release-safety] OK: ${tracked.length} tracked files checked; no local credential files are tracked.`)
