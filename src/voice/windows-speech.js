import { spawn } from 'node:child_process'

function cultureFor(lang = 'en-US') {
  return /^zh/i.test(String(lang || '')) ? 'zh-CN' : 'en-US'
}

function buildPowerShell(culture) {
  return `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Speech
$culture = [System.Globalization.CultureInfo]::GetCultureInfo('${culture}')
$recognizer = [System.Speech.Recognition.SpeechRecognitionEngine]::new($culture)
$recognizer.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())
$recognizer.SetInputToDefaultAudioDevice()
$recognizer.add_SpeechHypothesized({ param($sender,$eventArgs)
  $json = @{type='transcript';text=$eventArgs.Result.Text;is_final=$false} | ConvertTo-Json -Compress
  [Console]::Out.WriteLine($json); [Console]::Out.Flush()
})
$recognizer.add_SpeechRecognized({ param($sender,$eventArgs)
  if ($eventArgs.Result.Text) {
    $json = @{type='transcript';text=$eventArgs.Result.Text;is_final=$true} | ConvertTo-Json -Compress
    [Console]::Out.WriteLine($json); [Console]::Out.Flush()
  }
})
$recognizer.add_RecognizeCompleted({ param($sender,$eventArgs)
  if ($eventArgs.Error) {
    $json = @{type='error';message=$eventArgs.Error.Message} | ConvertTo-Json -Compress
    [Console]::Out.WriteLine($json); [Console]::Out.Flush()
  }
})
$recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
[Console]::ReadLine() | Out-Null
$recognizer.RecognizeAsyncCancel()
$recognizer.Dispose()
`
}

export function createWindowsSpeechSession(config = {}, onTranscript, onError, onClose) {
  if (process.platform !== 'win32') {
    onError('Windows native speech recognition only supports Windows')
    return null
  }
  const script = buildPowerShell(cultureFor(config.lang))
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const child = spawn('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-EncodedCommand', encoded,
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env },
  })
  let stdoutBuffer = ''
  let closed = false
  child.stdout.on('data', chunk => {
    stdoutBuffer += chunk.toString('utf8')
    const lines = stdoutBuffer.split(/\r?\n/)
    stdoutBuffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line)
        if (event.type === 'transcript' && event.text) onTranscript(event.text, !!event.is_final)
        else if (event.type === 'error') onError(event.message || 'Windows speech recognition error')
      } catch {}
    }
  })
  child.stderr.on('data', chunk => {
    const message = chunk.toString('utf8').trim()
    if (message) console.warn(`[Voice:Windows] ${message}`)
  })
  child.once('error', error => onError(`Windows speech recognition failed to start: ${error.message}`))
  child.once('exit', code => {
    if (!closed && code) onError(`Windows speech recognition exited with code ${code}`)
    closed = true
    onClose?.()
  })
  return {
    sendAudio() {},
    flush() {},
    close() {
      if (closed) return
      closed = true
      try { child.stdin.end('\n') } catch {}
      const timer = setTimeout(() => { try { child.kill() } catch {} }, 1000)
      timer.unref?.()
    },
  }
}
