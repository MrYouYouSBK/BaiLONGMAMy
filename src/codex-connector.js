import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { paths } from './paths.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(here, '..')
const MAX_OUTPUT = 2 * 1024 * 1024

function unpackedResourceRoot() {
  const root = paths.resourcesDir
  return root.endsWith('.asar') ? `${root}.unpacked` : root
}

export function resolveCodexCli() {
  const envPath = String(process.env.GAI_CODEX_BIN || process.env.CODEX_BIN || '').trim()
  const candidates = [
    envPath,
    path.join(unpackedResourceRoot(), 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
    path.join(projectRoot, 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) return { command: process.execPath, prefix: [candidate], source: 'bundled' }
    } catch {}
  }
  return { command: process.platform === 'win32' ? 'codex.exe' : 'codex', prefix: [], source: 'path' }
}

function runCodex(args, { input = '', signal, timeoutMs = 180_000, onLine } = {}) {
  const resolved = resolveCodexCli()
  return new Promise((resolve, reject) => {
    const child = spawn(resolved.command, [...resolved.prefix, ...args], {
      cwd: paths.sandboxDir,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: resolved.source === 'bundled' ? '1' : process.env.ELECTRON_RUN_AS_NODE,
        NO_COLOR: '1',
      },
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    let lineBuffer = ''
    const timer = setTimeout(() => {
      try { child.kill() } catch {}
      if (!settled) reject(Object.assign(new Error('Codex connector timed out'), { code: 'ETIMEDOUT' }))
      settled = true
    }, timeoutMs)
    timer.unref?.()
    const abort = () => {
      try { child.kill() } catch {}
      if (!settled) reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
      settled = true
    }
    signal?.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', chunk => {
      stdout = (stdout + chunk.toString('utf8')).slice(-MAX_OUTPUT)
      lineBuffer += chunk.toString('utf8')
      const lines = lineBuffer.split(/\r?\n/)
      lineBuffer = lines.pop() || ''
      for (const line of lines) onLine?.(line)
    })
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString('utf8')).slice(-MAX_OUTPUT) })
    child.once('error', error => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      if (!settled) reject(error)
      settled = true
    })
    child.once('exit', code => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      if (lineBuffer) onLine?.(lineBuffer)
      if (settled) return
      settled = true
      resolve({ ok: code === 0, code, stdout, stderr, resolved })
    })
    if (input) child.stdin.end(input)
    else child.stdin.end()
  })
}

export async function getCodexStatus() {
  try {
    const result = await runCodex(['login', 'status'], { timeoutMs: 15_000 })
    const output = `${result.stdout}\n${result.stderr}`.trim()
    return {
      installed: true,
      signedIn: result.ok && /logged in|chatgpt|authenticated|active/i.test(output),
      status: result.ok ? (output || 'Codex is available') : (output || 'Not signed in'),
      source: result.resolved.source,
    }
  } catch (error) {
    const notFound = error?.code === 'ENOENT'
    return { installed: !notFound, signedIn: false, status: notFound ? 'Codex connector is not installed' : (error?.message || String(error)) }
  }
}

export async function loginCodex() {
  try {
    const result = await runCodex(['login'], { timeoutMs: 10 * 60 * 1000 })
    const output = `${result.stdout}\n${result.stderr}`.trim()
    return { ok: result.ok, status: output || (result.ok ? 'Signed in with ChatGPT' : 'Sign-in did not complete') }
  } catch (error) {
    return { ok: false, status: error?.message || String(error) }
  }
}

function promptFromMessages(messages = []) {
  return messages
    .slice(-24)
    .map(item => `${String(item?.role || 'user').toUpperCase()}: ${String(item?.content || '').trim()}`)
    .filter(line => !line.endsWith(':'))
    .join('\n\n')
}

export async function createCodexStreamResult({ messages = [], signal, onStream } = {}) {
  const prompt = [
    'You are the text reasoning connector inside GAI AI. Answer the final USER message directly.',
    'Do not edit files, run commands, or claim actions. Stay concise and use the user\'s language.',
    '',
    promptFromMessages(messages),
  ].join('\n')
  let content = ''
  const result = await runCodex([
    'exec',
    '--ephemeral',
    '--ignore-rules',
    '--json',
    '--color', 'never',
    '--sandbox', 'read-only',
    '--skip-git-repo-check',
    '-C', paths.sandboxDir,
    '-',
  ], {
    input: prompt,
    signal,
    onLine(line) {
      try {
        const event = JSON.parse(line)
        if (event?.type === 'item.completed' && event?.item?.type === 'agent_message' && event.item.text) {
          content = String(event.item.text)
        }
      } catch {}
    },
  })
  if (!result.ok || !content) {
    const error = new Error((result.stderr || result.stdout || 'Codex did not return a response').trim())
    error.code = result.code
    throw error
  }
  onStream?.({ event: 'start', mode: 'text' })
  onStream?.({ event: 'chunk', text: content })
  onStream?.({ event: 'end', mode: 'text' })
  return { content, reasoningContent: '', aborted: false, toolCalls: [] }
}
