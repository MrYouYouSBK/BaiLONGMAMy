import { API } from './api-client.js';

const LANGUAGE_KEY = 'gai-ui-language';
const THEME_KEY = 'jarvis-brain-ui-theme';

const t = (en, zh) => `data-en="${en}" data-zh="${zh}"`;

export function createGaiControlMarkup() {
  return `
  <div class="settings-tab active" data-tab="gai-control">
    <div class="gai-control-hero">
      <div>
        <div class="gai-control-kicker">GAI AI 3.0</div>
        <h2 ${t('Offline-first control center', '離線優先控制中心')}>Offline-first control center</h2>
        <p ${t('Works immediately with GAI Offline Super. Cloud and local services are optional.', 'GAI Offline Super 可直接運行；雲端與本地服務均為選配。')}>Works immediately with GAI Offline Super. Cloud and local services are optional.</p>
      </div>
      <span class="gai-auto-badge" ${t('Automatic updates ON', '自動更新已開啟')}>Automatic updates ON</span>
    </div>

    <div class="gai-status-grid">
      <div class="gai-status"><span ${t('Offline AI', '離線 AI')}>Offline AI</span><strong class="ok" id="gai-offline-status">READY</strong></div>
      <div class="gai-status"><span ${t('Local models', '本地模型')}>Local models</span><strong id="gai-local-ai-status">CHECKING</strong></div>
      <div class="gai-status"><span>ChatGPT / Codex</span><strong id="gai-codex-status">CHECKING</strong></div>
      <div class="gai-status"><span ${t('Microphone', '麥克風')}>Microphone</span><strong id="gai-mic-status">CHECKING</strong></div>
      <div class="gai-status"><span ${t('Camera', '攝像頭')}>Camera</span><strong id="gai-camera-status">CHECKING</strong></div>
      <div class="gai-status"><span ${t('Updates', '版本更新')}>Updates</span><strong id="gai-update-status">AUTOMATIC</strong></div>
    </div>

    <div class="gai-control-grid">
      <section class="gai-card">
        <h3 ${t('Language & theme', '語言與主題')}>Language & theme</h3>
        <label><span ${t('Interface language', '介面語言')}>Interface language</span>
          <select id="gai-language-select"><option value="en">English (default)</option><option value="zh">中文</option></select>
        </label>
        <label><span ${t('Theme', '主題')}>Theme</span>
          <select id="gai-theme-select">
            <option value="amoled">AMOLED Black</option><option value="midnight">Midnight Steel</option>
            <option value="phosphor">Phosphor CRT</option><option value="violet">Violet Lab</option>
            <option value="rose">Rose Dusk</option><option value="arctic">Arctic</option><option value="sand">Warm Sand</option>
          </select>
        </label>
      </section>

      <section class="gai-card">
        <h3 ${t('AI engine', 'AI 引擎')}>AI engine</h3>
        <p ${t('No setup: GAI Offline Super. Optional local Ollama/LM Studio or OpenAI Codex with your ChatGPT account—no API key.', '無需配置即可使用 GAI Offline Super；也可連接 Ollama／LM Studio，或用 ChatGPT 帳戶登入 OpenAI Codex，無需 API Key。')}>No setup: GAI Offline Super. Optional local Ollama/LM Studio or OpenAI Codex with your ChatGPT account—no API key.</p>
        <div class="gai-actions">
          <button type="button" id="gai-use-offline" ${t('Use Offline Super', '使用 Offline Super')}>Use Offline Super</button>
          <button type="button" id="gai-detect-local-ai" ${t('Detect local AI', '檢測本地 AI')}>Detect local AI</button>
          <button type="button" id="gai-codex-login" ${t('Sign in with ChatGPT', '使用 ChatGPT 登入')}>Sign in with ChatGPT</button>
        </div>
        <div class="gai-inline-feedback" id="gai-ai-feedback"></div>
      </section>

      <section class="gai-card">
        <h3 ${t('Maps', '地圖服務')}>Maps</h3>
        <label><span ${t('Provider', '服務商')}>Provider</span>
          <select id="gai-map-provider"><option value="osm">OpenStreetMap (no key)</option><option value="google">Google Maps</option><option value="amap">Amap / 高德</option></select>
        </label>
        <label id="gai-map-key-row"><span ${t('Browser key', 'Web 端 Key')}>Browser key</span><input id="gai-map-key" type="password" autocomplete="new-password" placeholder="Leave blank to keep current key"></label>
        <label id="gai-map-security-row"><span>Amap securityJsCode</span><input id="gai-map-security" type="password" autocomplete="new-password" placeholder="Amap only"></label>
        <div class="gai-actions"><button type="button" id="gai-save-map" ${t('Save map', '保存地圖')}>Save map</button></div>
        <div class="gai-links"><a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noreferrer">Google key / sign in ↗</a><a href="https://console.amap.com/dev/key/app" target="_blank" rel="noreferrer">Amap key / 登入 ↗</a><a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap ↗</a></div>
        <div class="gai-inline-feedback" id="gai-map-feedback"></div>
      </section>

      <section class="gai-card">
        <h3 ${t('Web search', '搜索引擎')}>Web search</h3>
        <label><span ${t('Preferred engine', '首選引擎')}>Preferred engine</span>
          <select id="gai-search-provider"><option value="auto">Automatic</option><option value="google">Google (Serper)</option><option value="brave">Brave</option><option value="bing">Bing</option><option value="duckduckgo">DuckDuckGo</option><option value="tavily">Tavily</option><option value="jina">Jina</option></select>
        </label>
        <div class="gai-actions"><button type="button" id="gai-save-search" ${t('Save search', '保存搜索')}>Save search</button></div>
        <div class="gai-links"><a href="https://accounts.google.com" target="_blank" rel="noreferrer">Google sign in ↗</a><a href="https://serper.dev" target="_blank" rel="noreferrer">Google Search API ↗</a><a href="https://brave.com/search/api/" target="_blank" rel="noreferrer">Brave ↗</a><a href="https://tavily.com" target="_blank" rel="noreferrer">Tavily ↗</a></div>
        <div class="gai-inline-feedback" id="gai-search-feedback"></div>
      </section>

      <section class="gai-card">
        <h3 ${t('Voice recognition', '語音識別')}>Voice recognition</h3>
        <label><span ${t('Speech provider', '語音服務商')}>Speech provider</span>
          <select id="gai-voice-provider"><option value="local">Windows / macOS Native</option><option value="aliyun">Alibaba Cloud</option><option value="volcengine">Volcengine</option><option value="tencent">Tencent Cloud</option><option value="xunfei">iFlytek</option></select>
        </label>
        <div class="gai-actions"><button type="button" id="gai-save-voice" ${t('Save voice', '保存語音')}>Save voice</button><button type="button" id="gai-request-mic" ${t('Allow microphone', '允許麥克風')}>Allow microphone</button></div>
        <div class="gai-links"><a href="https://platform.openai.com/audio" target="_blank" rel="noreferrer">OpenAI audio ↗</a><a href="https://dashscope.console.aliyun.com" target="_blank" rel="noreferrer">Alibaba ↗</a><a href="https://console.volcengine.com/speech" target="_blank" rel="noreferrer">Volcengine ↗</a></div>
        <div class="gai-inline-feedback" id="gai-voice-feedback"></div>
      </section>

      <section class="gai-card">
        <h3 ${t('Media & camera', '媒體與攝像頭')}>Media & camera</h3>
        <label><span ${t('Media engine', '媒體引擎')}>Media engine</span>
          <select id="gai-media-provider"><option value="local">Local files / camera</option><option value="stable-diffusion">Local Stable Diffusion</option><option value="openai-compatible">OpenAI-compatible image model</option><option value="minimax">MiniMax</option><option value="auto">Automatic</option></select>
        </label>
        <div id="gai-media-openai-fields">
          <label><span>Base URL</span><input id="gai-media-baseurl" type="text" placeholder="https://api.openai.com/v1"></label>
          <label><span>API key</span><input id="gai-media-key" type="password" autocomplete="new-password" placeholder="Leave blank to keep current key"></label>
          <label><span ${t('Image model', '圖像模型')}>Image model</span><input id="gai-media-model" type="text" placeholder="gpt-image-1"></label>
        </div>
        <div id="gai-media-sd-fields">
          <label><span>Stable Diffusion URL</span><input id="gai-media-sd-url" type="text" placeholder="http://127.0.0.1:7860"></label>
        </div>
        <div class="gai-actions"><button type="button" id="gai-save-media" ${t('Save media', '保存媒體')}>Save media</button><button type="button" id="gai-open-camera" ${t('Open camera now', '立即開啟攝像頭')}>Open camera now</button></div>
        <div class="gai-links"><a href="https://chatgpt.com" target="_blank" rel="noreferrer">OpenAI / ChatGPT ↗</a><a href="https://aistudio.google.com" target="_blank" rel="noreferrer">Google AI Studio ↗</a><a href="https://platform.minimax.io" target="_blank" rel="noreferrer">MiniMax ↗</a></div>
        <div class="gai-inline-feedback" id="gai-media-feedback"></div>
      </section>
    </div>
  </div>`;
}

function locale() {
  return localStorage.getItem(LANGUAGE_KEY) === 'zh' ? 'zh' : 'en';
}

function applyLocale(next, { syncVoice = true } = {}) {
  const lang = next === 'zh' ? 'zh' : 'en';
  localStorage.setItem(LANGUAGE_KEY, lang);
  if (syncVoice) localStorage.setItem('bailongma-voice-lang', lang === 'zh' ? 'zh-CN' : 'en-US');
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-en][data-zh]').forEach((el) => {
    el.textContent = el.dataset[lang] || el.dataset.en;
  });
  const input = document.getElementById('msg-input');
  if (input && !input.value) input.placeholder = lang === 'zh'
    ? '向 GAI AI 發送消息…（輸入 / 調出命令，Shift+Enter 換行）'
    : 'Message GAI AI… (/ commands, Shift+Enter for a new line)';
}

function status(el, value, kind = '') {
  if (!el) return;
  el.textContent = String(value || '—').toUpperCase();
  el.classList.toggle('ok', kind === 'ok');
  el.classList.toggle('warn', kind === 'warn');
}

async function json(path, options) {
  const response = await fetch(`${API}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

export function initGaiControlCenter() {
  const langSelect = document.getElementById('gai-language-select');
  const themeSelect = document.getElementById('gai-theme-select');
  const localStatus = document.getElementById('gai-local-ai-status');
  const codexStatus = document.getElementById('gai-codex-status');
  const micStatus = document.getElementById('gai-mic-status');
  const cameraStatus = document.getElementById('gai-camera-status');
  const updateStatus = document.getElementById('gai-update-status');
  const mapProvider = document.getElementById('gai-map-provider');
  const mapKeyRow = document.getElementById('gai-map-key-row');
  const mapSecurityRow = document.getElementById('gai-map-security-row');
  const searchProvider = document.getElementById('gai-search-provider');
  const voiceProvider = document.getElementById('gai-voice-provider');
  const mediaProvider = document.getElementById('gai-media-provider');
  const mediaOpenAIFields = document.getElementById('gai-media-openai-fields');
  const mediaSDFields = document.getElementById('gai-media-sd-fields');

  const setFeedback = (id, message, error = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', error);
  };
  const post = (path, body) => json(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  langSelect.value = locale();
  applyLocale(langSelect.value, { syncVoice: false });
  langSelect.addEventListener('change', () => applyLocale(langSelect.value));
  themeSelect.value = localStorage.getItem(THEME_KEY) || 'midnight';
  themeSelect.addEventListener('change', () => {
    document.querySelector(`.theme-dot[data-t="${themeSelect.value}"]`)?.click();
  });

  const syncMapFields = () => {
    mapKeyRow.hidden = mapProvider.value === 'osm';
    mapSecurityRow.hidden = mapProvider.value !== 'amap';
  };
  mapProvider.addEventListener('change', syncMapFields);
  const syncMediaFields = () => {
    mediaOpenAIFields.hidden = mediaProvider.value !== 'openai-compatible';
    mediaSDFields.hidden = mediaProvider.value !== 'stable-diffusion';
  };
  mediaProvider.addEventListener('change', syncMediaFields);

  async function refreshDevices() {
    try {
      let device = await window.bailongma?.getDeviceStatus?.();
      if (!device && navigator.permissions?.query) {
        const [mic, camera] = await Promise.allSettled([
          navigator.permissions.query({ name: 'microphone' }),
          navigator.permissions.query({ name: 'camera' }),
        ]);
        device = { microphone: mic.value?.state, camera: camera.value?.state };
      }
      const classify = (value) => value === 'granted' ? 'ok' : value === 'denied' || value === 'restricted' ? 'warn' : '';
      status(micStatus, device?.microphone || 'ask on use', classify(device?.microphone));
      status(cameraStatus, device?.camera || 'ask on use', classify(device?.camera));
    } catch {
      status(micStatus, 'ask on use'); status(cameraStatus, 'ask on use');
    }
  }

  async function detectLocalAI() {
    status(localStatus, 'checking');
    try {
      const { localAI } = await json('/settings/local-ai');
      const available = (localAI?.providers || []).filter((service) => service.available);
      status(localStatus, available.length ? available.map((service) => service.label).join(' + ') : 'not found', available.length ? 'ok' : '');
      setFeedback('gai-ai-feedback', available.length
        ? available.map((service) => `${service.label}: ${(service.models || []).join(', ') || 'ready'}`).join(' · ')
        : (locale() === 'zh' ? '未發現 Ollama 或 LM Studio；離線引擎仍可使用。' : 'Ollama and LM Studio not detected; Offline Super remains available.'));
    } catch (error) { status(localStatus, 'offline'); setFeedback('gai-ai-feedback', error.message, true); }
  }

  async function refreshCodex() {
    try {
      const { codex } = await json('/settings/codex');
      status(codexStatus, codex.signedIn ? 'signed in' : codex.installed ? 'not signed in' : 'unavailable', codex.signedIn ? 'ok' : '');
    } catch { status(codexStatus, 'unavailable'); }
  }

  document.getElementById('gai-use-offline')?.addEventListener('click', async () => {
    try { await post('/settings/model', { provider: 'offline', model: 'gai-offline-super' }); setFeedback('gai-ai-feedback', locale() === 'zh' ? '已啟用 GAI Offline Super。' : 'GAI Offline Super is active.'); }
    catch (error) { setFeedback('gai-ai-feedback', error.message, true); }
  });
  document.getElementById('gai-detect-local-ai')?.addEventListener('click', detectLocalAI);
  document.getElementById('gai-codex-login')?.addEventListener('click', async () => {
    setFeedback('gai-ai-feedback', locale() === 'zh' ? '正在開啟 ChatGPT 登入…' : 'Opening ChatGPT sign-in…');
    try {
      await post('/settings/codex/login', {});
      await post('/settings/model', { provider: 'codex', model: 'codex-default' });
      await refreshCodex();
      setFeedback('gai-ai-feedback', locale() === 'zh' ? 'ChatGPT 登入成功，Codex 已啟用。' : 'Signed in with ChatGPT. Codex is active.');
    } catch (error) { setFeedback('gai-ai-feedback', error.message, true); }
  });

  document.getElementById('gai-save-map')?.addEventListener('click', async () => {
    try {
      await post('/settings/map', { provider: mapProvider.value, jsKey: document.getElementById('gai-map-key').value, securityCode: document.getElementById('gai-map-security').value });
      setFeedback('gai-map-feedback', locale() === 'zh' ? '地圖配置已保存，重新開啟地圖即可使用。' : 'Map settings saved. Reopen a map to use them.');
    } catch (error) { setFeedback('gai-map-feedback', error.message, true); }
  });
  document.getElementById('gai-save-search')?.addEventListener('click', async () => {
    try { await post('/settings/web-search', { preferredEngine: searchProvider.value }); setFeedback('gai-search-feedback', locale() === 'zh' ? '搜索引擎已保存。' : 'Search engine saved.'); }
    catch (error) { setFeedback('gai-search-feedback', error.message, true); }
  });
  document.getElementById('gai-save-voice')?.addEventListener('click', async () => {
    try { await post('/settings/voice', { voiceProvider: voiceProvider.value }); localStorage.setItem('bailongma-voice-provider', voiceProvider.value); setFeedback('gai-voice-feedback', locale() === 'zh' ? '語音服務已保存。' : 'Voice provider saved.'); }
    catch (error) { setFeedback('gai-voice-feedback', error.message, true); }
  });
  document.getElementById('gai-request-mic')?.addEventListener('click', async () => {
    try {
      await window.bailongma?.requestMediaAccess?.('microphone');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach((track) => track.stop());
      await refreshDevices();
    } catch (error) { setFeedback('gai-voice-feedback', error.message, true); }
  });
  document.getElementById('gai-save-media')?.addEventListener('click', async () => {
    try {
      await post('/settings/media-provider', {
        provider: mediaProvider.value,
        openaiBaseURL: document.getElementById('gai-media-baseurl').value,
        openaiApiKey: document.getElementById('gai-media-key').value,
        openaiModel: document.getElementById('gai-media-model').value,
        stableDiffusionBaseURL: document.getElementById('gai-media-sd-url').value,
      });
      document.getElementById('gai-media-key').value = '';
      setFeedback('gai-media-feedback', locale() === 'zh' ? '媒體引擎已保存並立即生效。' : 'Media engine saved and active.');
    } catch (error) { setFeedback('gai-media-feedback', error.message, true); }
  });
  document.getElementById('gai-open-camera')?.addEventListener('click', () => document.getElementById('camera-btn')?.click());

  Promise.allSettled([
    json('/settings/map').then(({ map }) => { mapProvider.value = map?.provider || 'osm'; syncMapFields(); }),
    json('/settings/web-search').then(({ webSearch }) => { searchProvider.value = webSearch?.preferredEngine || 'auto'; }),
    json('/settings/voice').then(({ voice }) => { voiceProvider.value = voice?.voiceProvider || 'local'; }),
    json('/settings/media-provider').then(({ media }) => {
      mediaProvider.value = media?.provider || 'local';
      document.getElementById('gai-media-baseurl').value = media?.openaiBaseURL || 'https://api.openai.com/v1';
      document.getElementById('gai-media-model').value = media?.openaiModel || 'gpt-image-1';
      document.getElementById('gai-media-sd-url').value = media?.stableDiffusionBaseURL || 'http://127.0.0.1:7860';
      syncMediaFields();
    }),
  ]).catch(() => {});
  syncMediaFields();
  window.bailongma?.onUpdaterStatus?.((payload) => status(updateStatus, payload?.stage || 'automatic', payload?.stage === 'downloaded' || payload?.stage === 'up-to-date' ? 'ok' : ''));
  refreshDevices();
  detectLocalAI();
  refreshCodex();
}
