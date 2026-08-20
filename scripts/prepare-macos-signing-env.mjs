#!/usr/bin/env node

import { appendFileSync, chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { createPrivateKey, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const REQUIRED_FIELDS = [
  'MAC_CERTIFICATE_BASE64',
  'MAC_CERTIFICATE_PASSWORD',
  'APPLE_API_KEY_P8',
  'APPLE_API_KEY_ID',
  'APPLE_API_ISSUER_ID',
]

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function unwrapSecretValue(value) {
  let unwrapped = clean(value).replace(/^\uFEFF/, '')
  const wrappers = [
    ['`', '`'],
    ['"', '"'],
    ["'", "'"],
  ]
  for (const [start, end] of wrappers) {
    if (unwrapped.startsWith(start) && unwrapped.endsWith(end) && unwrapped.length > 1) {
      unwrapped = unwrapped.slice(start.length, -end.length).trim()
      break
    }
  }
  return unwrapped
}

function compactBase64(value) {
  let compact = unwrapSecretValue(value)
    .replace(/^data:[^,]*;base64,/i, '')
    .replace(/^base64\s*[:=]\s*/i, '')
    .replace(/\\r\\n|\\n|\\r/g, '')
    .replace(/\s+/g, '')
    .replaceAll('-', '+')
    .replaceAll('_', '/')

  if (!compact || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact) || compact.length % 4 === 1) {
    return ''
  }
  compact = compact.replace(/=+$/, '')
  return compact.padEnd(Math.ceil(compact.length / 4) * 4, '=')
}

function decodeBase64(value, label) {
  const compact = compactBase64(value)
  if (!compact) throw new Error(`${label} is not valid Base64 or Base64URL`)
  const decoded = Buffer.from(compact, 'base64')
  if (decoded.length === 0) throw new Error(`${label} decoded to an empty value`)
  return decoded
}

function normalizePem(value) {
  const normalized = unwrapSecretValue(value)
    .replaceAll('\\r\\n', '\n')
    .replaceAll('\\n', '\n')
    .replaceAll('\\r', '\n')
  const match = normalized.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/)
  if (!match) return ''
  const body = compactBase64(match[1])
  if (!body) return ''
  const lines = body.match(/.{1,64}/g) || []
  const pem = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`
  try {
    return createPrivateKey(pem).export({ format: 'pem', type: 'pkcs8' }).toString().trim()
  } catch {
    return ''
  }
}

function pemFromDer(der) {
  if (!der.length || der[0] !== 0x30) return ''
  try {
    return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })
      .export({ format: 'pem', type: 'pkcs8' })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

function normalizeP8(value) {
  const directPem = normalizePem(value)
  if (directPem) return directPem

  let decoded
  try {
    decoded = decodeBase64(value, 'APPLE_API_KEY_P8_BASE64 in Repository secret KEY')
  } catch {
    throw new Error(
      'APPLE_API_KEY_P8_BASE64 in Repository secret KEY is neither valid Base64/Base64URL nor a complete PEM private key',
    )
  }

  const decodedText = decoded.toString('utf8').trim()
  const decodedPem = normalizePem(decodedText)
  if (decodedPem) return decodedPem

  const derPem = pemFromDer(decoded)
  if (derPem) return derPem

  // Some secret managers export the PEM body as Base64 text, resulting in one
  // additional encoding layer. Accept that representation without weakening
  // the later complete-PEM validation.
  const nestedCompact = compactBase64(decodedText)
  if (nestedCompact) {
    const nestedDer = Buffer.from(nestedCompact, 'base64')
    const nestedPem = pemFromDer(nestedDer)
    if (nestedPem) return nestedPem
  }

  throw new Error(
    'APPLE_API_KEY_P8_BASE64 in Repository secret KEY did not decode to a PEM or PKCS#8 private key',
  )
}

function parseKeyBundle(rawValue) {
  const raw = clean(rawValue)
  if (!raw) return {}

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(
      'Repository secret KEY must be a JSON object containing: ' + REQUIRED_FIELDS.join(', '),
    )
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Repository secret KEY must contain one JSON object')
  }
  return parsed.credentials && typeof parsed.credentials === 'object'
    ? parsed.credentials
    : parsed
}

export function resolveSigningCredentials(env = process.env) {
  const bundle = parseKeyBundle(env.GAI_MAC_SIGNING_KEY_BUNDLE)
  const credentials = Object.fromEntries(REQUIRED_FIELDS.map(field => [
    field,
    clean(env[field]) || clean(bundle[field]),
  ]))
  if (!credentials.APPLE_API_KEY_P8 && clean(bundle.APPLE_API_KEY_P8_BASE64)) {
    credentials.APPLE_API_KEY_P8 = normalizeP8(bundle.APPLE_API_KEY_P8_BASE64)
  } else if (credentials.APPLE_API_KEY_P8) {
    credentials.APPLE_API_KEY_P8 = normalizePem(credentials.APPLE_API_KEY_P8) || credentials.APPLE_API_KEY_P8
  }
  const missing = REQUIRED_FIELDS.filter(field => !credentials[field])
  if (missing.length > 0) {
    throw new Error(
      `Missing Apple signing fields: ${missing.join(', ')}. ` +
      'Add the five named Repository secrets, or put all five fields in the JSON Repository secret KEY. ' +
      'KEY may use APPLE_API_KEY_P8_BASE64 instead of APPLE_API_KEY_P8.',
    )
  }

  const certificate = decodeBase64(credentials.MAC_CERTIFICATE_BASE64, 'MAC_CERTIFICATE_BASE64')
  if (certificate.length < 64) {
    throw new Error('MAC_CERTIFICATE_BASE64 did not decode to a usable PKCS#12 certificate')
  }

  if (!credentials.APPLE_API_KEY_P8.includes('-----BEGIN PRIVATE KEY-----') ||
      !credentials.APPLE_API_KEY_P8.includes('-----END PRIVATE KEY-----')) {
    throw new Error('APPLE_API_KEY_P8 must contain the complete Apple private key')
  }
  if (!/^[A-Za-z0-9]+$/.test(credentials.APPLE_API_KEY_ID)) {
    throw new Error('APPLE_API_KEY_ID must contain only letters and numbers')
  }

  return { ...credentials, certificate }
}

function appendEnvironmentValue(file, name, value) {
  let delimiter
  do delimiter = `GAI_${randomUUID().replaceAll('-', '')}`
  while (String(value).includes(delimiter))
  appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`, { encoding: 'utf8' })
}

export function prepareSigningEnvironment(env = process.env) {
  const runnerTemp = clean(env.RUNNER_TEMP)
  const githubEnv = clean(env.GITHUB_ENV)
  if (!runnerTemp || !githubEnv) {
    throw new Error('RUNNER_TEMP and GITHUB_ENV are required on the GitHub Actions runner')
  }

  const credentials = resolveSigningCredentials(env)
  mkdirSync(runnerTemp, { recursive: true })

  const certificatePath = join(runnerTemp, 'GAI-AI-Developer-ID-Application.p12')
  const apiKeyPath = join(runnerTemp, `AuthKey_${credentials.APPLE_API_KEY_ID}.p8`)
  writeFileSync(certificatePath, credentials.certificate, { mode: 0o600 })
  writeFileSync(apiKeyPath, credentials.APPLE_API_KEY_P8, { encoding: 'utf8', mode: 0o600 })
  chmodSync(certificatePath, 0o600)
  chmodSync(apiKeyPath, 0o600)

  appendEnvironmentValue(githubEnv, 'CSC_LINK', certificatePath)
  appendEnvironmentValue(githubEnv, 'CSC_KEY_PASSWORD', credentials.MAC_CERTIFICATE_PASSWORD)
  appendEnvironmentValue(githubEnv, 'APPLE_API_KEY', apiKeyPath)
  appendEnvironmentValue(githubEnv, 'APPLE_API_KEY_ID', credentials.APPLE_API_KEY_ID)
  appendEnvironmentValue(githubEnv, 'APPLE_API_ISSUER', credentials.APPLE_API_ISSUER_ID)
  appendEnvironmentValue(githubEnv, 'CSC_IDENTITY_AUTO_DISCOVERY', 'true')

  return { certificatePath, apiKeyPath }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  try {
    prepareSigningEnvironment()
    console.log('[mac-signing] Apple signing environment prepared without exposing credential values')
  } catch (error) {
    console.error(`[mac-signing] ${error?.message || error}`)
    process.exitCode = 1
  }
}
