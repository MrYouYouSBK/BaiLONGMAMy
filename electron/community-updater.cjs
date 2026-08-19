const { EventEmitter } = require('events')
const crypto = require('crypto')
const fs = require('fs')
const https = require('https')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const DEFAULT_REPOSITORY = 'MrYouYouSBK/GAI_Ai.My'
const EXPECTED_BUNDLE_ID = 'com.mryouyousbk.gaiai'
const MAX_REDIRECTS = 8

function normalizeVersion(value = '') {
  return String(value || '').trim().replace(/^community-v/i, '').replace(/^v/i, '').split('-')[0]
}

function versionParts(value) {
  return normalizeVersion(value).split('.').map(part => Number.parseInt(part, 10) || 0)
}

function compareVersions(left, right) {
  const a = versionParts(left)
  const b = versionParts(right)
  const length = Math.max(a.length, b.length, 3)
  for (let index = 0; index < length; index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0)
    if (delta) return delta > 0 ? 1 : -1
  }
  return 0
}

function releaseVersion(release = {}) {
  return normalizeVersion(release.tag_name || release.name || '')
}

function selectReleaseAssets(release, arch) {
  const version = releaseVersion(release)
  const assets = Array.isArray(release?.assets) ? release.assets : []
  const zipName = `GAI-AI-${version}-mac-${arch}.zip`
  const zip = assets.find(asset => asset?.name === zipName)
  const checksums = assets.find(asset => asset?.name === 'SHA256SUMS.txt')
  if (!zip) throw new Error(`Release ${version} is missing ${zipName}`)
  if (!checksums) throw new Error(`Release ${version} is missing SHA256SUMS.txt`)
  return { version, zip, checksums }
}

function parseChecksumFile(text, filename) {
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/i)
    if (match && path.basename(match[2].trim()) === filename) return match[1].toLowerCase()
  }
  throw new Error(`No SHA-256 entry found for ${filename}`)
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  const fd = fs.openSync(filePath, 'r')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try {
    let bytes = 0
    while ((bytes = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, bytes))
  } finally { fs.closeSync(fd) }
  return hash.digest('hex')
}

function findAppBundle(executablePath) {
  const parts = path.resolve(executablePath).split(path.sep)
  const appIndex = parts.findIndex(part => part.toLowerCase().endsWith('.app'))
  if (appIndex < 0) return null
  return path.join(path.sep, ...parts.slice(1, appIndex + 1))
}

function findExtractedApp(root, depth = 0) {
  if (depth > 4) return null
  let entries = []
  try { entries = fs.readdirSync(root, { withFileTypes: true }) } catch { return null }
  for (const entry of entries) if (entry.isDirectory() && entry.name === 'GAI AI.app') return path.join(root, entry.name)
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.endsWith('.app')) continue
    const found = findExtractedApp(path.join(root, entry.name), depth + 1)
    if (found) return found
  }
  return null
}

function quoteShell(value) { return `'${String(value).replace(/'/g, `'"'"'`)}'` }

function parseCodesignDetails(output = '') {
  const text = String(output || '')
  const teamIdentifier = text.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim() || ''
  const authorities = [...text.matchAll(/^Authority=(.+)$/gm)].map(match => match[1].trim())
  return { teamIdentifier: teamIdentifier === 'not set' ? '' : teamIdentifier, authorities }
}

function checked(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} verification failed: ${result.stderr || result.stdout || 'unknown error'}`)
  }
  return `${result.stdout || ''}\n${result.stderr || ''}`.trim()
}

function inspectMacSignature(appBundle) {
  return parseCodesignDetails(checked('/usr/bin/codesign', ['-dvvv', appBundle]))
}

function verifyTrustedMacUpdate(sourceBundle, currentBundle = null) {
  checked('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', sourceBundle])
  const signature = inspectMacSignature(sourceBundle)
  if (!signature.authorities.some(authority => authority.startsWith('Developer ID Application:'))) {
    throw new Error('Downloaded update is not signed with an Apple Developer ID Application certificate')
  }
  if (!signature.teamIdentifier) throw new Error('Downloaded update signature has no Apple TeamIdentifier')

  const bundleId = checked('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', path.join(sourceBundle, 'Contents', 'Info.plist')]).trim()
  if (bundleId !== EXPECTED_BUNDLE_ID) throw new Error(`Downloaded update has unexpected bundle identifier: ${bundleId || 'missing'}`)

  // Do not call xcrun/stapler on an end-user machine: clean Macs may not have
  // Xcode Command Line Tools.  CI validates the stapled ticket before release;
  // Gatekeeper's built-in assessment verifies the signed/notarized bundle here.
  checked('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=4', sourceBundle])

  if (currentBundle) {
    try {
      const current = inspectMacSignature(currentBundle)
      if (current.teamIdentifier && current.teamIdentifier !== signature.teamIdentifier) {
        throw new Error(`Downloaded update is signed by a different Apple team (${signature.teamIdentifier})`)
      }
    } catch (error) {
      if (/different Apple team/.test(error?.message || '')) throw error
      // The first trusted upgrade can originate from the legacy unsigned 3.2 build.
    }
  }
  return { bundleId, teamIdentifier: signature.teamIdentifier }
}

function requestBuffer(url, { headers = {}, redirects = 0, onProgress } = {}) {
  if (redirects > MAX_REDIRECTS) return Promise.reject(new Error('Too many download redirects'))
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers }, response => {
      const status = Number(response.statusCode || 0)
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume()
        requestBuffer(new URL(response.headers.location, url).toString(), { headers, redirects: redirects + 1, onProgress }).then(resolve, reject)
        return
      }
      if (status < 200 || status >= 300) { response.resume(); reject(new Error(`HTTP ${status} for ${new URL(url).host}`)); return }
      const total = Number(response.headers['content-length'] || 0)
      const chunks = []
      let transferred = 0
      response.on('data', chunk => { chunks.push(chunk); transferred += chunk.length; onProgress?.({ transferred, total, percent: total ? (transferred / total) * 100 : 0 }) })
      response.on('end', () => resolve(Buffer.concat(chunks)))
      response.on('error', reject)
    })
    request.setTimeout(30000, () => request.destroy(new Error('Update request timed out')))
    request.on('error', reject)
  })
}

function downloadToFile(url, targetPath, { headers = {}, redirects = 0, onProgress } = {}) {
  if (redirects > MAX_REDIRECTS) return Promise.reject(new Error('Too many download redirects'))
  return new Promise((resolve, reject) => {
    let settled = false
    let output = null
    const fail = error => {
      if (settled) return
      settled = true
      try { output?.destroy() } catch {}
      try { fs.unlinkSync(targetPath) } catch {}
      reject(error)
    }
    const request = https.get(url, { headers }, response => {
      const status = Number(response.statusCode || 0)
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume()
        downloadToFile(new URL(response.headers.location, url).toString(), targetPath, { headers, redirects: redirects + 1, onProgress }).then(resolve, reject)
        return
      }
      if (status < 200 || status >= 300) { response.resume(); fail(new Error(`HTTP ${status} for ${new URL(url).host}`)); return }
      const total = Number(response.headers['content-length'] || 0)
      let transferred = 0
      output = fs.createWriteStream(targetPath, { flags: 'w' })
      response.on('data', chunk => { transferred += chunk.length; onProgress?.({ transferred, total, percent: total ? (transferred / total) * 100 : 0 }) })
      response.on('error', fail)
      output.on('error', fail)
      output.on('finish', () => { if (!settled) { settled = true; output.close(() => resolve(transferred)) } })
      response.pipe(output)
    })
    request.setTimeout(30000, () => request.destroy(new Error('Update download timed out')))
    request.on('error', fail)
  })
}

class CommunityMacUpdater extends EventEmitter {
  constructor({ app, repository = DEFAULT_REPOSITORY, arch = process.arch, cacheDir } = {}) {
    super()
    if (!app) throw new Error('CommunityMacUpdater requires the Electron app object')
    this.app = app
    this.repository = repository
    this.arch = arch === 'arm64' ? 'arm64' : 'x64'
    this.cacheDir = cacheDir || path.join(app.getPath('userData'), 'pending-update')
    this.autoDownload = true
    this.autoInstallOnAppQuit = true
    this.autoRunAppAfterInstall = true
    this.updateInfo = null
    this.downloaded = null
    this.installing = false
    this.headers = { Accept: 'application/vnd.github+json', 'User-Agent': `GAI-AI-Updater/${app.getVersion?.() || 'desktop'}`, 'X-GitHub-Api-Version': '2022-11-28' }
  }

  async checkForUpdates() {
    this.emit('checking-for-update')
    try {
      const endpoint = `https://api.github.com/repos/${this.repository}/releases/latest`
      const release = JSON.parse((await requestBuffer(endpoint, { headers: this.headers })).toString('utf8'))
      const assets = selectReleaseAssets(release, this.arch)
      const info = { version: assets.version, releaseName: release.name || release.tag_name, releaseDate: release.published_at || release.created_at, releaseNotes: release.body || '', _assets: assets }
      if (release.draft || release.prerelease || compareVersions(info.version, this.app.getVersion()) <= 0) { this.emit('update-not-available', info); return { updateInfo: info } }
      this.updateInfo = info
      this.emit('update-available', info)
      if (this.autoDownload) await this.downloadUpdate()
      return { updateInfo: info }
    } catch (error) { this.emit('error', error); throw error }
  }

  async downloadUpdate() {
    try {
      if (!this.updateInfo) {
        const previousAutoDownload = this.autoDownload
        this.autoDownload = false
        try { await this.checkForUpdates() } finally { this.autoDownload = previousAutoDownload }
      }
      if (!this.updateInfo || compareVersions(this.updateInfo.version, this.app.getVersion()) <= 0) return []
      const { zip, checksums } = this.updateInfo._assets
      fs.mkdirSync(this.cacheDir, { recursive: true })
      const expected = parseChecksumFile((await requestBuffer(checksums.browser_download_url, { headers: this.headers })).toString('utf8'), zip.name)
      const partialPath = path.join(this.cacheDir, `${zip.name}.part`)
      const finalPath = path.join(this.cacheDir, zip.name)
      try { fs.unlinkSync(partialPath) } catch {}
      await downloadToFile(zip.browser_download_url, partialPath, { headers: this.headers, onProgress: progress => this.emit('download-progress', progress) })
      const actual = sha256File(partialPath)
      if (actual !== expected) { try { fs.unlinkSync(partialPath) } catch {}; throw new Error(`SHA-256 verification failed for ${zip.name}`) }
      try { fs.unlinkSync(finalPath) } catch {}
      fs.renameSync(partialPath, finalPath)
      this.downloaded = { filePath: finalPath, version: this.updateInfo.version, sha256: actual }
      this.emit('update-downloaded', this.updateInfo)
      return [finalPath]
    } catch (error) { this.emit('error', error); throw error }
  }

  prepareInstall() {
    if (!this.downloaded?.filePath || !fs.existsSync(this.downloaded.filePath)) throw new Error('No verified update has been downloaded')
    const currentBundle = findAppBundle(process.execPath)
    if (!currentBundle) throw new Error('Could not locate the running GAI AI.app bundle')
    const stageDir = path.join(this.cacheDir, `stage-${this.downloaded.version}`)
    fs.rmSync(stageDir, { recursive: true, force: true })
    fs.mkdirSync(stageDir, { recursive: true })
    const result = spawnSync('/usr/bin/ditto', ['-x', '-k', this.downloaded.filePath, stageDir], { encoding: 'utf8' })
    if (result.status !== 0) throw new Error(`Could not extract update: ${result.stderr || result.stdout || 'ditto failed'}`)
    const sourceBundle = findExtractedApp(stageDir)
    if (!sourceBundle) throw new Error('The verified update archive does not contain GAI AI.app')
    verifyTrustedMacUpdate(sourceBundle, currentBundle)
    return { currentBundle, sourceBundle, stageDir }
  }

  spawnInstaller() {
    if (this.installing) return true
    const { currentBundle, sourceBundle, stageDir } = this.prepareInstall()
    const backupBundle = `${currentBundle}.gai-backup-${Date.now()}`
    const scriptPath = path.join(this.cacheDir, 'install-verified-update.sh')
    const script = `#!/bin/sh\nset -u\npid=${process.pid}\nwhile kill -0 "$pid" 2>/dev/null; do sleep 0.2; done\ntarget=${quoteShell(currentBundle)}\nsource_app=${quoteShell(sourceBundle)}\nbackup=${quoteShell(backupBundle)}\nstage=${quoteShell(stageDir)}\nif ! mv "$target" "$backup"; then exit 20; fi\nif /usr/bin/ditto "$source_app" "$target" && /usr/bin/open "$target"; then\n  /bin/rm -rf "$backup" "$stage"\n  exit 0\nfi\n/bin/rm -rf "$target"\nmv "$backup" "$target"\n/usr/bin/open "$target"\nexit 21\n`
    fs.writeFileSync(scriptPath, script, { mode: 0o700 })
    const child = spawn('/bin/sh', [scriptPath], { detached: true, stdio: 'ignore' })
    child.unref()
    this.installing = true
    return true
  }

  installOnQuit() { if (!this.autoInstallOnAppQuit || !this.downloaded || this.installing) return false; try { return this.spawnInstaller() } catch (error) { this.emit('error', error); return false } }
  quitAndInstall() { this.spawnInstaller(); this.app.quit() }
}

module.exports = { CommunityMacUpdater, compareVersions, findAppBundle, normalizeVersion, parseChecksumFile, parseCodesignDetails, releaseVersion, selectReleaseAssets, sha256File, verifyTrustedMacUpdate }
