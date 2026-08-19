import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import updater from '../electron/community-updater.cjs'

const { compareVersions, normalizeVersion, parseChecksumFile, parseCodesignDetails, selectReleaseAssets, sha256File } = updater

assert.equal(normalizeVersion('community-v3.2.0'), '3.2.0')
assert.equal(compareVersions('3.2.0', '3.1.9'), 1)
assert.equal(compareVersions('3.2.0', '3.2.0'), 0)
assert.equal(compareVersions('3.1.9', '3.2.0'), -1)

const release = {
  tag_name: 'community-v3.2.0',
  assets: [
    { name: 'GAI-AI-3.2.0-mac-arm64.zip', browser_download_url: 'https://example.invalid/arm64.zip' },
    { name: 'SHA256SUMS.txt', browser_download_url: 'https://example.invalid/SHA256SUMS.txt' },
  ],
}
assert.equal(selectReleaseAssets(release, 'arm64').zip.name, 'GAI-AI-3.2.0-mac-arm64.zip')
assert.throws(() => selectReleaseAssets(release, 'x64'), /missing GAI-AI-3\.2\.0-mac-x64\.zip/)

assert.deepEqual(parseCodesignDetails(`Authority=Developer ID Application: GAI AI (TEAM123456)\nAuthority=Developer ID Certification Authority\nTeamIdentifier=TEAM123456\n`), {
  teamIdentifier: 'TEAM123456',
  authorities: ['Developer ID Application: GAI AI (TEAM123456)', 'Developer ID Certification Authority'],
})
assert.equal(parseCodesignDetails('TeamIdentifier=not set').teamIdentifier, '')

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'gai-updater-test-'))
try {
  const file = path.join(temp, 'asset.zip')
  fs.writeFileSync(file, 'verified GAI AI update')
  const digest = sha256File(file)
  assert.equal(parseChecksumFile(`${digest}  asset.zip\n`, 'asset.zip'), digest)
  assert.throws(() => parseChecksumFile(`${digest}  other.zip\n`, 'asset.zip'), /No SHA-256 entry/)
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}

console.log('GAI AI community updater checks passed')
