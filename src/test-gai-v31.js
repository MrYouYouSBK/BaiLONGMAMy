import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const tempUserDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gai-v31-test-'))
process.env.BAILONGMA_USER_DIR = tempUserDir
process.env.BAILONGMA_RESOURCES_DIR = repo
globalThis.window = { location: { protocol: 'file:' } }

try {
  const { getTTSConfig, getTTSCredentials } = await import('./config.js')
  const { TTS_PROVIDERS, TTS_VOICES, validateTTSConfig } = await import('./voice/tts-providers.js')
  const { getMediaProviderSettings, setMediaProviderSettings } = await import('./media-provider-config.js')
  const { getVoiceProfile, saveVoiceProfileDataUrl } = await import('./voice/voice-profile.js')
  const { createBrainUiMarkup } = await import('./ui/brain-ui/app-shell.js')
  const { translateStaticUiAttr, translateStaticUiText } = await import('./ui/brain-ui/ui-i18n.js')

  assert.equal(getTTSConfig().ttsProvider, 'system')
  assert.equal(getTTSCredentials().provider, 'system')
  assert.equal(validateTTSConfig({ provider: 'system' }).ok, true)
  assert.equal(TTS_PROVIDERS[0].id, 'system')
  assert.equal(TTS_PROVIDERS[0].paid, false)
  assert.ok(TTS_PROVIDERS.filter(item => item.id !== 'system').every(item => item.paid === true))
  assert.ok(TTS_VOICES.system.some(voice => voice.id === 'system-auto'))
  saveVoiceProfileDataUrl(`data:audio/webm;codecs=opus;base64,${Buffer.from('voice-sample').toString('base64')}`)
  assert.equal(getVoiceProfile().configured, true)
  assert.equal(getVoiceProfile().storage, 'local-only')

  setMediaProviderSettings({ provider: 'gemini', geminiApiKey: 'test-key', geminiImageModel: 'gemini-test', videoProvider: 'gemini', geminiVideoModel: 'veo-test' })
  const media = getMediaProviderSettings()
  assert.equal(media.provider, 'gemini')
  assert.equal(media.videoProvider, 'gemini')
  assert.equal(media.geminiImageModel, 'gemini-test')
  assert.equal(media.geminiVideoModel, 'veo-test')
  assert.equal(media.geminiKeyConfigured, true)
  assert.equal('geminiApiKey' in media, false)

  const shell = fs.readFileSync(path.join(repo, 'src/ui/brain-ui/app-shell.js'), 'utf8')
  const control = fs.readFileSync(path.join(repo, 'src/ui/brain-ui/gai-control-center.js'), 'utf8')
  const video = fs.readFileSync(path.join(repo, 'src/capabilities/tools/media/video-generation.js'), 'utf8')
  const asr = fs.readFileSync(path.join(repo, 'src/voice/cloud-asr.js'), 'utf8')
  assert.match(shell, /value="system"/)
  assert.match(shell, /value="bilingual"/)
  assert.match(shell, /voice-profile-record/)
  assert.match(control, /gai-google-search/)
  assert.match(control, /gai-search-history/)
  assert.match(control, /gai-gemini-video-model/)
  assert.match(control, /projectselector2\/home\/dashboard/)
  assert.match(video, /predictLongRunning/)
  assert.match(video, /geminiPollLoop/)
  assert.match(video, /inlineData/)
  assert.doesNotMatch(video, /generateAudio: true/)
  assert.match(asr, /\['zh', 'en'\]/)
  const untranslated = [...createBrainUiMarkup().matchAll(/>([^<>]+)</g)]
    .map(match => match[1].trim())
    .filter(text => /[\u3400-\u9fff]/.test(text) && !translateStaticUiText(text, 'en'))
  assert.deepEqual([...new Set(untranslated)], [], `English Settings has untranslated text: ${[...new Set(untranslated)].join(' | ')}`)
  const untranslatedAttrs = [...createBrainUiMarkup().matchAll(/(?:placeholder|title|aria-label|alt)="([^"]*[\u3400-\u9fff][^"]*)"/g)]
    .map(match => match[1]).filter(value => !translateStaticUiAttr(value, 'en'))
  assert.deepEqual([...new Set(untranslatedAttrs)], [], `English UI has untranslated attributes: ${[...new Set(untranslatedAttrs)].join(' | ')}`)
  console.log('GAI AI 3.1 feature checks passed')
} finally {
  fs.rmSync(tempUserDir, { recursive: true, force: true })
}
