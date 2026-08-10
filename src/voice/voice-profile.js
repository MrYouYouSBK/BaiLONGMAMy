import fs from 'fs'
import path from 'path'
import { paths } from '../paths.js'

const PROFILE_FILE = path.join(paths.voiceConfigDir, 'voice-profile.json')
const MIME_EXT = new Map([
  ['audio/webm', 'webm'], ['audio/ogg', 'ogg'], ['audio/mp4', 'm4a'],
  ['audio/wav', 'wav'], ['audio/x-wav', 'wav'],
])

function readProfileFile() {
  try { return JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8')) || {} } catch { return {} }
}

export function getVoiceProfile() {
  const profile = readProfileFile()
  const samplePath = profile.sampleFile ? path.join(paths.voiceConfigDir, path.basename(profile.sampleFile)) : ''
  return {
    configured: Boolean(samplePath && fs.existsSync(samplePath)),
    createdAt: profile.createdAt || null,
    mimeType: profile.mimeType || '',
    size: profile.size || 0,
    sampleUrl: samplePath && fs.existsSync(samplePath) ? '/tts/voice-profile/sample' : '',
    storage: 'local-only',
  }
}

export function saveVoiceProfileDataUrl(dataUrl) {
  const match = /^data:(audio\/[\w.+-]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/i.exec(String(dataUrl || ''))
  if (!match) throw new Error('Invalid voice sample')
  const mimeType = match[1].toLowerCase()
  const extension = MIME_EXT.get(mimeType)
  if (!extension) throw new Error(`Unsupported voice sample type: ${mimeType}`)
  const bytes = Buffer.from(match[2], 'base64')
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error('Voice sample must be between 1 byte and 10 MB')
  fs.mkdirSync(paths.voiceConfigDir, { recursive: true })

  const previous = readProfileFile()
  if (previous.sampleFile) {
    try { fs.rmSync(path.join(paths.voiceConfigDir, path.basename(previous.sampleFile)), { force: true }) } catch {}
  }
  const sampleFile = `voice-profile-sample.${extension}`
  fs.writeFileSync(path.join(paths.voiceConfigDir, sampleFile), bytes)
  const profile = { sampleFile, mimeType, size: bytes.length, createdAt: new Date().toISOString(), storage: 'local-only' }
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf8')
  return getVoiceProfile()
}

export function readVoiceProfileSample() {
  const profile = readProfileFile()
  if (!profile.sampleFile) return null
  const file = path.join(paths.voiceConfigDir, path.basename(profile.sampleFile))
  if (!fs.existsSync(file)) return null
  return { bytes: fs.readFileSync(file), mimeType: profile.mimeType || 'audio/webm' }
}
