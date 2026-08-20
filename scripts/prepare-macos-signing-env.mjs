#!/usr/bin/env node

import { appendFileSync, chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
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
    const bundledP8 = clean(bundle.APPLE_API_KEY_P8_BASE64).replaceAll('\\n', '\n')
    if (bundledP8.includes('-----BEGIN PRIVATE KEY-----')) {
      credentials.APPLE_API_KEY_P8 = bundledP8
    } else {
      const compactP8 = bundledP8.replace(/\s+/g, '')
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compactP8)) {
        throw new Error(
          'APPLE_API_KEY_P8_BASE64 in Repository secret KEY is neither valid Base64 nor a complete PEM private key',
        )
      }
      credentials.APPLE_API_KEY_P8 = Buffer.from(compactP8, 'base64').toString('utf8').trim()
    }
  }
  const missing = REQUIRED_FIELDS.filter(field => !credentials[field])
  if (missing.length > 0) {
    throw new Error(
      `Missing Apple signing fields: ${missing.join(', ')}. ` +
      'Add the five named Repository secrets, or put all five fields in the JSON Repository secret KEY. ' +
      'KEY may use APPLE_API_KEY_P8_BASE64 instead of APPLE_API_KEY_P8.',
    )
  }

  const compactCertificate = credentials.MAC_CERTIFICATE_BASE64.replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compactCertificate)) {
    throw new Error('MAC_CERTIFICATE_BASE64 is not valid Base64')
  }
  const certificate = Buffer.from(compactCertificate, 'base64')
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
