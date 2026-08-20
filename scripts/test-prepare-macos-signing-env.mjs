import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  prepareSigningEnvironment,
  resolveSigningCredentials,
} from './prepare-macos-signing-env.mjs'

const certificateBytes = Buffer.from('PKCS12 test certificate bytes '.repeat(4))
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const testP8 = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString().trim()
const fields = {
  MAC_CERTIFICATE_BASE64: certificateBytes.toString('base64'),
  MAC_CERTIFICATE_PASSWORD: 'test-password',
  APPLE_API_KEY_P8: testP8,
  APPLE_API_KEY_ID: 'ABC123DEFG',
  APPLE_API_ISSUER_ID: '11111111-2222-3333-4444-555555555555',
}

const fromBundle = resolveSigningCredentials({
  GAI_MAC_SIGNING_KEY_BUNDLE: JSON.stringify(fields),
})
assert.equal(fromBundle.MAC_CERTIFICATE_PASSWORD, fields.MAC_CERTIFICATE_PASSWORD)
assert.deepEqual(fromBundle.certificate, certificateBytes)

const p8Base64Bundle = resolveSigningCredentials({
  GAI_MAC_SIGNING_KEY_BUNDLE: JSON.stringify({
    ...fields,
    APPLE_API_KEY_P8: undefined,
    APPLE_API_KEY_P8_BASE64: Buffer.from(fields.APPLE_API_KEY_P8).toString('base64'),
  }),
})
assert.equal(p8Base64Bundle.APPLE_API_KEY_P8, fields.APPLE_API_KEY_P8)

const rawP8InBase64Field = resolveSigningCredentials({
  GAI_MAC_SIGNING_KEY_BUNDLE: JSON.stringify({
    ...fields,
    APPLE_API_KEY_P8: undefined,
    APPLE_API_KEY_P8_BASE64: fields.APPLE_API_KEY_P8.replaceAll('\n', '\\n'),
  }),
})
assert.equal(rawP8InBase64Field.APPLE_API_KEY_P8, fields.APPLE_API_KEY_P8)

const p8Base64Url = Buffer.from(fields.APPLE_API_KEY_P8)
  .toString('base64')
  .replaceAll('+', '-')
  .replaceAll('/', '_')
  .replace(/=+$/, '')
const base64UrlBundle = resolveSigningCredentials({
  GAI_MAC_SIGNING_KEY_BUNDLE: JSON.stringify({
    ...fields,
    MAC_CERTIFICATE_BASE64: certificateBytes.toString('base64url'),
    APPLE_API_KEY_P8: undefined,
    APPLE_API_KEY_P8_BASE64: `data:application/octet-stream;base64,${p8Base64Url}`,
  }),
})
assert.equal(base64UrlBundle.APPLE_API_KEY_P8, fields.APPLE_API_KEY_P8)
assert.deepEqual(base64UrlBundle.certificate, certificateBytes)

const p8Body = fields.APPLE_API_KEY_P8
  .replace('-----BEGIN PRIVATE KEY-----', '')
  .replace('-----END PRIVATE KEY-----', '')
  .replace(/\s+/g, '')
const bodyOnlyBundle = resolveSigningCredentials({
  GAI_MAC_SIGNING_KEY_BUNDLE: JSON.stringify({
    ...fields,
    APPLE_API_KEY_P8: undefined,
    APPLE_API_KEY_P8_BASE64: p8Body,
  }),
})
assert.equal(bodyOnlyBundle.APPLE_API_KEY_P8, fields.APPLE_API_KEY_P8)

const explicitWins = resolveSigningCredentials({
  ...fields,
  MAC_CERTIFICATE_PASSWORD: 'individual-secret-password',
  GAI_MAC_SIGNING_KEY_BUNDLE: JSON.stringify({
    ...fields,
    MAC_CERTIFICATE_PASSWORD: 'bundle-password',
  }),
})
assert.equal(explicitWins.MAC_CERTIFICATE_PASSWORD, 'individual-secret-password')

assert.throws(
  () => resolveSigningCredentials({ GAI_MAC_SIGNING_KEY_BUNDLE: 'not-json' }),
  /KEY must be a JSON object/,
)
assert.throws(
  () => resolveSigningCredentials({ GAI_MAC_SIGNING_KEY_BUNDLE: JSON.stringify({ APPLE_API_KEY_ID: 'ABC' }) }),
  /Missing Apple signing fields/,
)

const root = mkdtempSync(join(tmpdir(), 'gai-signing-test-'))
try {
  const githubEnv = join(root, 'github-env.txt')
  const result = prepareSigningEnvironment({
    GAI_MAC_SIGNING_KEY_BUNDLE: JSON.stringify(fields),
    RUNNER_TEMP: root,
    GITHUB_ENV: githubEnv,
  })
  assert.deepEqual(readFileSync(result.certificatePath), certificateBytes)
  assert.equal(readFileSync(result.apiKeyPath, 'utf8'), fields.APPLE_API_KEY_P8)

  const exported = readFileSync(githubEnv, 'utf8')
  for (const name of [
    'CSC_LINK',
    'CSC_KEY_PASSWORD',
    'APPLE_API_KEY',
    'APPLE_API_KEY_ID',
    'APPLE_API_ISSUER',
    'CSC_IDENTITY_AUTO_DISCOVERY',
  ]) {
    assert.match(exported, new RegExp(`^${name}<<GAI_`, 'm'))
  }
  assert.doesNotMatch(exported, /PKCS12 test certificate bytes/)
} finally {
  rmSync(root, { recursive: true, force: true })
}

console.log('macOS signing KEY bundle tests passed')
