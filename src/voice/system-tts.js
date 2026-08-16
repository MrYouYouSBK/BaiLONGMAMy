import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options })
    let stderr = ''
    child.stderr?.on('data', chunk => { stderr += chunk.toString() })
    child.once('error', reject)
    child.once('exit', code => code === 0
      ? resolve()
      : reject(new Error(`${command} exited with ${code}: ${stderr.trim().slice(0, 240)}`)))
  })
}

function systemVoice(voiceId, text) {
  if (voiceId === 'system-zh') return 'zh'
  if (voiceId === 'system-en') return 'en'
  if (voiceId && !['auto', 'system-auto'].includes(voiceId)) return voiceId
  return /[\u3400-\u9fff]/.test(text) ? 'zh' : 'en'
}

async function synthesizeMac(text, output, voiceId) {
  const requested = systemVoice(voiceId, text)
  const args = ['-o', output, '--file-format=WAVE', '--data-format=LEI16@22050']
  if (requested === 'zh' || requested === 'system-zh') args.push('-v', 'Ting-Ting')
  else if (requested === 'en' || requested === 'system-en') args.push('-v', 'Samantha')
  args.push(text)
  try { await run('say', args) }
  catch {
    // Enhanced voices may not be downloaded. The default macOS voice is
    // still preferable to returning silence.
    await run('say', ['-o', output, '--file-format=WAVE', '--data-format=LEI16@22050', text])
  }
}

async function synthesizeWindows(text, output, voiceId) {
  const preferred = systemVoice(voiceId, text)
  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    "$want = $env:GAI_TTS_VOICE",
    'if ($want -eq "zh") { $v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like "zh-*" } | Select-Object -First 1 }',
    'elseif ($want -eq "en") { $v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like "en-*" } | Select-Object -First 1 }',
    'else { $v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -eq $want } | Select-Object -First 1 }',
    'if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }',
    '$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:GAI_TTS_TEXT_B64))',
    '$s.SetOutputToWaveFile($env:GAI_TTS_OUTPUT)',
    '$s.Speak($text)',
    '$s.Dispose()',
  ].join('; ')
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    env: {
      ...process.env,
      GAI_TTS_TEXT_B64: Buffer.from(text, 'utf8').toString('base64'),
      GAI_TTS_OUTPUT: output,
      GAI_TTS_VOICE: preferred,
    },
  })
}

async function synthesizeLinux(text, output, voiceId) {
  const voice = systemVoice(voiceId, text)
  const args = ['-w', output]
  if (voice === 'zh' || voice === 'system-zh') args.push('-v', 'zh')
  else args.push('-v', 'en')
  args.push(text)
  try { await run('espeak-ng', args) }
  catch (first) {
    try { await run('espeak', args) }
    catch { throw new Error(`System TTS is unavailable: install an OS voice or eSpeak (${first.message})`) }
  }
}

export async function synthesizeSystemTTS({ text, voiceId = 'system-auto' }) {
  const dir = path.join(os.tmpdir(), `gai-system-tts-${randomUUID()}`)
  const output = path.join(dir, 'speech.wav')
  fs.mkdirSync(dir, { recursive: true })
  try {
    if (process.platform === 'darwin') await synthesizeMac(text, output, voiceId)
    else if (process.platform === 'win32') await synthesizeWindows(text, output, voiceId)
    else await synthesizeLinux(text, output, voiceId)
    const stream = fs.createReadStream(output)
    stream.contentType = 'audio/wav'
    stream.extension = 'wav'
    const cleanup = () => { try { fs.rmSync(dir, { recursive: true, force: true }) } catch {} }
    stream.once('close', cleanup)
    stream.once('error', cleanup)
    return stream
  } catch (error) {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
    throw error
  }
}
