import { API } from './api-client.js'

function toDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function initVoiceProfileUI() {
  const button = document.getElementById('voice-profile-record')
  const status = document.getElementById('voice-profile-status')
  const player = document.getElementById('voice-profile-player')
  if (!button || !status || !player) return

  let recorder = null
  let stream = null
  let timer = null
  let chunks = []

  const render = (profile) => {
    if (!profile?.configured) {
      status.textContent = '尚未錄製；樣本只保存在此裝置。'
      player.hidden = true
      return
    }
    const time = profile.createdAt ? new Date(profile.createdAt).toLocaleString() : ''
    status.textContent = `已保存本機語音樣本 ${time}`
    player.src = `${API}${profile.sampleUrl}?t=${Date.now()}`
    player.hidden = false
  }

  fetch(`${API}/tts/voice-profile`).then(r => r.json()).then(render).catch(() => {})

  button.addEventListener('click', async () => {
    if (recorder?.state === 'recording') {
      recorder.stop()
      return
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      chunks = []
      recorder = new MediaRecorder(stream)
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data) }
      recorder.onstop = async () => {
        clearTimeout(timer)
        stream?.getTracks().forEach(track => track.stop())
        button.disabled = true
        status.textContent = '正在保存到本機…'
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
          const response = await fetch(`${API}/tts/voice-profile`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sample: await toDataUrl(blob) }),
          })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
          render(data.profile)
        } catch (error) { status.textContent = `保存失敗：${error.message}` }
        finally { button.disabled = false; button.textContent = '錄製 6 秒語音樣本' }
      }
      recorder.start(250)
      button.textContent = '停止並保存'
      status.textContent = '錄音中…請自然說一段中英文。最多 6 秒。'
      timer = setTimeout(() => recorder?.state === 'recording' && recorder.stop(), 6000)
    } catch (error) { status.textContent = `無法使用系統麥克風：${error.message}` }
  })
}
