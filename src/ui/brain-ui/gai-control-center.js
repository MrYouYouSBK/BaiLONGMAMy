import { API } from './api-client.js';
import { applyUiLocale, currentUiLocale } from './ui-i18n.js';

const THEME_KEY = 'jarvis-brain-ui-theme';
const SEARCH_HISTORY_KEY = 'gai-google-search-history';

const t = (en, zh) => `data-en="${en}" data-zh="${zh}"`;

export function createGaiControlMarkup() {
  return `
  <div class="settings-tab active" data-tab="gai-control">
    <div class="gai-control-hero">
      <div>
        <div class="gai-control-kicker">GAI AI 3.2</div>
        <h2 ${t('Local-first desktop control center', '本機優先桌面控制中心')}>Local-first desktop control center</h2>
        <p ${t('Always-on multilingual voice, Apple Silicon acceleration, verified updates, screen sharing and timelines in one place.', '常駐多語音、Apple 晶片加速、驗證更新、螢幕分享與時間線集中管理。')}>Always-on multilingual voice, Apple Silicon acceleration, verified updates, screen sharing and timelines in one place.</p>
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
      <div class="gai-status"><span ${t('Hardware', '硬體')}>Hardware</span><strong id="gai-hardware-status">CHECKING</strong></div>
      <div class="gai-status"><span ${t('Wake listener', '喚醒監聽')}>Wake listener</span><strong id="gai-wake-status">CHECKING</strong></div>
      <div class="gai-status"><span ${t('Screen sharing', '螢幕分享')}>Screen sharing</span><strong id="gai-screen-status">OFF</strong></div>
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
          <button type="button" id="gai-use-local-ai" disabled ${t('Use recommended local model', '使用建議本機模型')}>Use recommended local model</button>
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
        <p ${t('If the Google key page will not open, use these steps in order:', '若 Google Key 頁面打不開，請依序使用：')}>If the Google key page will not open, use these steps in order:</p>
        <div class="gai-links"><a href="https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fconsole.cloud.google.com%2F" target="_blank" rel="noreferrer">1. Choose Google account ↗</a><a href="https://console.cloud.google.com/projectselector2/home/dashboard" target="_blank" rel="noreferrer">2. Select / create project ↗</a><a href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com" target="_blank" rel="noreferrer">3. Enable Maps API ↗</a><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">4. Create key ↗</a><a href="https://console.amap.com/dev/key/app" target="_blank" rel="noreferrer">Amap key ↗</a></div>
        <div class="gai-inline-feedback" id="gai-map-feedback"></div>
      </section>

      <section class="gai-card">
        <h3 ${t('Web search', '搜索引擎')}>Web search</h3>
        <p ${t('Use your normal Google browser session; GAI AI never reads your Google password or token. Search history is stored only on this device.', '使用瀏覽器現有的 Google 登入；GAI AI 不會讀取 Google 密碼或 Token。搜索紀錄只保存在此裝置。')}>Use your normal Google browser session; GAI AI never reads your Google password or token. Search history is stored only on this device.</p>
        <label><span ${t('Google search', 'Google 搜索')}>Google search</span><input id="gai-google-query" type="search" placeholder="Search with your Google account"></label>
        <div class="gai-actions"><button type="button" id="gai-google-search" ${t('Search Google', '用 Google 搜索')}>Search Google</button><button type="button" id="gai-clear-search-history" ${t('Clear local history', '清除本機紀錄')}>Clear local history</button></div>
        <div class="gai-search-history" id="gai-search-history"></div>
        <label><span ${t('Preferred engine', '首選引擎')}>Preferred engine</span>
          <select id="gai-search-provider"><option value="auto">Automatic</option><option value="google">Google (Serper)</option><option value="brave">Brave</option><option value="bing">Bing</option><option value="duckduckgo">DuckDuckGo</option><option value="tavily">Tavily</option><option value="jina">Jina</option></select>
        </label>
        <div class="gai-actions"><button type="button" id="gai-save-search" ${t('Save search', '保存搜索')}>Save search</button></div>
        <div class="gai-links"><a href="https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fwww.google.com%2F" target="_blank" rel="noreferrer">Choose Google account ↗</a><a href="https://serper.dev" target="_blank" rel="noreferrer">Google Search API ↗</a><a href="https://brave.com/search/api/" target="_blank" rel="noreferrer">Brave ↗</a><a href="https://tavily.com" target="_blank" rel="noreferrer">Tavily ↗</a></div>
        <div class="gai-inline-feedback" id="gai-search-feedback"></div>
      </section>

      <section class="gai-card">
        <h3 ${t('Voice recognition', '語音識別')}>Voice recognition</h3>
        <label><span ${t('Recognition language', '識別語言')}>Recognition language</span><select id="gai-voice-language"><option value="multilingual">中文 + English + Bahasa Melayu (default)</option><option value="bilingual">中文 + English</option><option value="en-US">English</option><option value="zh-CN">中文</option><option value="ms-MY">Bahasa Melayu</option></select></label>
        <label><span ${t('Speech provider', '語音服務商')}>Speech provider</span>
          <select id="gai-voice-provider"><option value="local">Windows / macOS Native</option><option value="aliyun">Alibaba Cloud</option><option value="volcengine">Volcengine</option><option value="tencent">Tencent Cloud</option><option value="xunfei">iFlytek</option></select>
        </label>
        <div class="gai-actions"><button type="button" id="gai-save-voice" ${t('Save voice', '保存語音')}>Save voice</button><button type="button" id="gai-request-mic" ${t('Allow microphone', '允許麥克風')}>Allow microphone</button></div>
        <div class="gai-links"><a href="https://platform.openai.com/audio" target="_blank" rel="noreferrer">OpenAI audio ↗</a><a href="https://dashscope.console.aliyun.com" target="_blank" rel="noreferrer">Alibaba ↗</a><a href="https://console.volcengine.com/speech" target="_blank" rel="noreferrer">Volcengine ↗</a></div>
        <div class="gai-inline-feedback" id="gai-voice-feedback"></div>
      </section>

      <section class="gai-card">
        <h3 ${t('Desktop, wake & timeline', '桌面、喚醒與時間線')}>Desktop, wake & timeline</h3>
        <label class="gai-switch-row"><span ${t('Always listen for wake phrase', '常駐聆聽喚醒詞')}>Always listen for wake phrase</span><input id="gai-wake-enabled" type="checkbox"></label>
        <label><span ${t('Wake trigger', '喚醒方式')}>Wake trigger</span><select id="gai-wake-trigger"><option value="phrase">GAI AI / Hey GAI</option><option value="sound">Specific sound</option></select></label>
        <label class="gai-switch-row"><span ${t('Double-clap wake sound', '雙拍手聲喚醒')}>Double-clap wake sound</span><input id="gai-double-clap" type="checkbox"></label>
        <label class="gai-switch-row"><span ${t('Enable screen sharing', '啟用螢幕分享')}>Enable screen sharing</span><input id="gai-screen-sharing" type="checkbox"></label>
        <label class="gai-switch-row"><span ${t('Play startup music', '播放啟動音樂')}>Play startup music</span><input id="gai-startup-music" type="checkbox"></label>
        <div class="gai-actions"><button type="button" id="gai-attach-screen" ${t('Attach current screen', '附加目前螢幕')}>Attach current screen</button></div>
        <hr>
        <label><span ${t('Task', '任務')}>Task</span><input id="gai-reminder-task" type="text" placeholder="What must be completed?"></label>
        <label><span ${t('Timeline', '時間線')}>Timeline</span><input id="gai-reminder-due" type="datetime-local"></label>
        <div class="gai-actions"><button type="button" id="gai-add-reminder" ${t('Add automatic follow-up', '加入自動跟進')}>Add automatic follow-up</button><button type="button" id="gai-refresh-reminders" ${t('Refresh', '重新整理')}>Refresh</button></div>
        <div class="gai-search-history" id="gai-reminder-list"></div>
        <div class="gai-inline-feedback" id="gai-desktop-feedback"></div>
      </section>

      <section class="gai-card">
        <h3 ${t('Media & camera', '媒體與攝像頭')}>Media & camera</h3>
        <label><span ${t('Media engine', '媒體引擎')}>Media engine</span>
          <select id="gai-media-provider"><option value="local">Local files / camera (free)</option><option value="stable-diffusion">Local Stable Diffusion (free)</option><option value="gemini" style="color:#ef4444">Gemini / Nano Banana (may charge)</option><option value="doubao" style="color:#ef4444">Doubao Seedream (may charge)</option><option value="openai-compatible" style="color:#ef4444">OpenAI-compatible image model (may charge)</option><option value="minimax" style="color:#ef4444">MiniMax (may charge)</option><option value="auto">Automatic</option></select>
        </label>
        <p class="gai-paid-note" ${t('Red cloud models may incur third-party charges. Local media remains the default.', '紅色雲端模型可能產生第三方費用；本機媒體仍為預設。')}>Red cloud models may incur third-party charges. Local media remains the default.</p>
        <div id="gai-media-openai-fields">
          <label><span>Base URL</span><input id="gai-media-baseurl" type="text" placeholder="https://api.openai.com/v1"></label>
          <label><span>API key</span><input id="gai-media-key" type="password" autocomplete="new-password" placeholder="Leave blank to keep current key"></label>
          <label><span ${t('Image model', '圖像模型')}>Image model</span><input id="gai-media-model" type="text" placeholder="gpt-image-1"></label>
        </div>
        <div id="gai-media-sd-fields">
          <label><span>Stable Diffusion URL</span><input id="gai-media-sd-url" type="text" placeholder="http://127.0.0.1:7860"></label>
        </div>
        <div id="gai-media-gemini-fields">
          <label><span>Gemini API key</span><input id="gai-gemini-key" type="password" autocomplete="new-password" placeholder="Leave blank to keep current key"></label>
          <label><span ${t('Image model', '圖像模型')}>Image model</span><input id="gai-gemini-image-model" type="text" placeholder="gemini-3.1-flash-image"></label>
          <label><span ${t('Video model', '影片模型')}>Video model</span><input id="gai-gemini-video-model" type="text" placeholder="veo-3.1-lite-generate-preview"></label>
        </div>
        <div id="gai-media-doubao-fields">
          <label><span>Doubao Ark API key</span><input id="gai-doubao-key" type="password" autocomplete="new-password" placeholder="Leave blank to keep current key"></label>
          <label><span>Ark Base URL</span><input id="gai-doubao-baseurl" type="text" placeholder="https://ark.cn-beijing.volces.com/api/v3"></label>
          <label><span ${t('Seedream model / endpoint ID', 'Seedream 模型／接入點 ID')}>Seedream model / endpoint ID</span><input id="gai-doubao-image-model" type="text" placeholder="Your exact model or ep-… ID"></label>
        </div>
        <label><span ${t('Video provider', '影片服務商')}>Video provider</span><select id="gai-video-provider"><option value="seedance" style="color:#ef4444">Doubao Seedance (may charge)</option><option value="gemini" style="color:#ef4444">Gemini Veo (paid-only API)</option></select></label>
        <div id="gai-media-seedance-fields">
          <label><span>Seedance API key</span><input id="gai-seedance-key" type="password" autocomplete="new-password" placeholder="Leave blank to keep current key"></label>
          <label><span>Seedance model / endpoint ID</span><input id="gai-seedance-model" type="text" placeholder="doubao-seedance-… or ep-…"></label>
          <label><span>Seedance Base URL</span><input id="gai-seedance-baseurl" type="text" placeholder="https://ark.cn-beijing.volces.com/api/v3"></label>
        </div>
        <div class="gai-actions"><button type="button" id="gai-save-media" ${t('Save media', '保存媒體')}>Save media</button><button type="button" id="gai-open-camera" ${t('Open camera now', '立即開啟攝像頭')}>Open camera now</button></div>
        <div class="gai-links"><a href="https://chatgpt.com" target="_blank" rel="noreferrer">OpenAI / ChatGPT ↗</a><a href="https://aistudio.google.com" target="_blank" rel="noreferrer">Google AI Studio ↗</a><a href="https://platform.minimax.io" target="_blank" rel="noreferrer">MiniMax ↗</a></div>
        <div class="gai-inline-feedback" id="gai-media-feedback"></div>
      </section>
    </div>
  </div>`;
}

function locale() {
  return currentUiLocale();
}

function applyLocale(next) {
  const lang = next === 'zh' ? 'zh' : 'en';
  applyUiLocale(lang);
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
  const desktop = window.gai || window.bailongma;
  const langSelect = document.getElementById('gai-language-select');
  const themeSelect = document.getElementById('gai-theme-select');
  const localStatus = document.getElementById('gai-local-ai-status');
  const codexStatus = document.getElementById('gai-codex-status');
  const micStatus = document.getElementById('gai-mic-status');
  const cameraStatus = document.getElementById('gai-camera-status');
  const updateStatus = document.getElementById('gai-update-status');
  const hardwareStatus = document.getElementById('gai-hardware-status');
  const wakeStatus = document.getElementById('gai-wake-status');
  const screenStatus = document.getElementById('gai-screen-status');
  const mapProvider = document.getElementById('gai-map-provider');
  const mapKeyRow = document.getElementById('gai-map-key-row');
  const mapSecurityRow = document.getElementById('gai-map-security-row');
  const searchProvider = document.getElementById('gai-search-provider');
  const voiceProvider = document.getElementById('gai-voice-provider');
  const voiceLanguage = document.getElementById('gai-voice-language');
  const mediaProvider = document.getElementById('gai-media-provider');
  const videoProvider = document.getElementById('gai-video-provider');
  const mediaOpenAIFields = document.getElementById('gai-media-openai-fields');
  const mediaSDFields = document.getElementById('gai-media-sd-fields');
  const mediaGeminiFields = document.getElementById('gai-media-gemini-fields');
  const mediaDoubaoFields = document.getElementById('gai-media-doubao-fields');
  const mediaSeedanceFields = document.getElementById('gai-media-seedance-fields');
  const useLocalAI = document.getElementById('gai-use-local-ai');
  const wakeEnabled = document.getElementById('gai-wake-enabled');
  const wakeTrigger = document.getElementById('gai-wake-trigger');
  const doubleClap = document.getElementById('gai-double-clap');
  const screenSharing = document.getElementById('gai-screen-sharing');
  const startupMusic = document.getElementById('gai-startup-music');
  let recommendedLocalAI = null;

  const setFeedback = (id, message, error = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', error);
  };
  const post = (path, body) => json(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  const openExternal = (url) => desktop?.openExternal?.(url) || window.open(url, '_blank', 'noopener');
  document.querySelectorAll('.gai-links a[href]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (!desktop?.openExternal) return;
      event.preventDefault();
      openExternal(link.href);
    });
  });

  langSelect.value = locale();
  applyLocale(langSelect.value);
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
    mediaGeminiFields.hidden = mediaProvider.value !== 'gemini' && videoProvider.value !== 'gemini';
    mediaDoubaoFields.hidden = mediaProvider.value !== 'doubao';
    mediaSeedanceFields.hidden = videoProvider.value !== 'seedance';
  };
  mediaProvider.addEventListener('change', syncMediaFields);
  videoProvider.addEventListener('change', syncMediaFields);

  function readSearchHistory() {
    try { const value = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function renderSearchHistory() {
    const root = document.getElementById('gai-search-history');
    if (!root) return;
    root.replaceChildren();
    for (const item of readSearchHistory().slice(0, 8)) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'gai-history-item'; button.textContent = item.query;
      button.title = new Date(item.at).toLocaleString();
      button.addEventListener('click', () => openExternal(`https://www.google.com/search?q=${encodeURIComponent(item.query)}`));
      root.appendChild(button);
    }
  }
  function runGoogleSearch() {
    const input = document.getElementById('gai-google-query');
    const query = String(input?.value || '').trim();
    if (!query) return;
    const next = [{ query, at: new Date().toISOString() }, ...readSearchHistory().filter(item => item?.query !== query)].slice(0, 20);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
    renderSearchHistory();
    openExternal(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
  }
  document.getElementById('gai-google-search')?.addEventListener('click', runGoogleSearch);
  document.getElementById('gai-google-query')?.addEventListener('keydown', event => { if (event.key === 'Enter') runGoogleSearch(); });
  document.getElementById('gai-clear-search-history')?.addEventListener('click', () => { localStorage.removeItem(SEARCH_HISTORY_KEY); renderSearchHistory(); });
  renderSearchHistory();

  async function refreshDevices() {
    try {
      let device = await desktop?.getDeviceStatus?.();
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
      recommendedLocalAI = localAI?.recommended || null;
      useLocalAI.disabled = !recommendedLocalAI;
      const hardware = localAI?.hardware || {};
      const hardwareLabel = hardware.appleChip || `${hardware.cpu || hardware.arch || 'CPU'} · ${hardware.logicalCores || '?'} cores`;
      status(hardwareStatus, hardwareLabel, hardware.appleSilicon ? 'ok' : '');
      status(localStatus, available.length ? available.map((service) => service.label).join(' + ') : 'not found', available.length ? 'ok' : '');
      setFeedback('gai-ai-feedback', available.length
        ? `${hardwareLabel} · ${available.map((service) => `${service.label}: ${(service.models || []).join(', ') || 'ready'}`).join(' · ')}${recommendedLocalAI ? ` · Recommended: ${recommendedLocalAI.label}` : ''}`
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
  useLocalAI?.addEventListener('click', async () => {
    if (!recommendedLocalAI) return;
    try {
      await post('/settings/model', { provider: 'custom', apiKey: 'none', model: recommendedLocalAI.model, baseURL: recommendedLocalAI.baseURL });
      setFeedback('gai-ai-feedback', `${recommendedLocalAI.label} · ${recommendedLocalAI.model || 'local model'} is active.`);
    } catch (error) { setFeedback('gai-ai-feedback', error.message, true); }
  });
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
    try { await post('/settings/voice', { voiceProvider: voiceProvider.value }); localStorage.setItem('bailongma-voice-provider', voiceProvider.value); localStorage.setItem('bailongma-voice-lang', voiceLanguage.value); document.getElementById('voice-lang-select') && (document.getElementById('voice-lang-select').value = voiceLanguage.value); setFeedback('gai-voice-feedback', locale() === 'zh' ? '語音服務與中英馬多語設定已保存。' : 'Voice provider and Chinese + English + Malay recognition saved.'); }
    catch (error) { setFeedback('gai-voice-feedback', error.message, true); }
  });
  document.getElementById('gai-request-mic')?.addEventListener('click', async () => {
    try {
      await desktop?.requestMediaAccess?.('microphone');
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
        geminiApiKey: document.getElementById('gai-gemini-key').value,
        geminiImageModel: document.getElementById('gai-gemini-image-model').value,
        geminiVideoModel: document.getElementById('gai-gemini-video-model').value,
        doubaoApiKey: document.getElementById('gai-doubao-key').value,
        doubaoBaseURL: document.getElementById('gai-doubao-baseurl').value,
        doubaoImageModel: document.getElementById('gai-doubao-image-model').value,
        videoProvider: videoProvider.value,
        seedanceApiKey: document.getElementById('gai-seedance-key').value,
        seedanceModel: document.getElementById('gai-seedance-model').value,
        seedanceBaseURL: document.getElementById('gai-seedance-baseurl').value,
      });
      document.getElementById('gai-media-key').value = '';
      document.getElementById('gai-gemini-key').value = '';
      document.getElementById('gai-doubao-key').value = '';
      document.getElementById('gai-seedance-key').value = '';
      setFeedback('gai-media-feedback', locale() === 'zh' ? '媒體引擎已保存並立即生效。' : 'Media engine saved and active.');
    } catch (error) { setFeedback('gai-media-feedback', error.message, true); }
  });
  document.getElementById('gai-open-camera')?.addEventListener('click', () => document.getElementById('camera-btn')?.click());

  function syncDesktopStatus(preferences = {}) {
    wakeEnabled.checked = preferences.wakeEnabled !== false;
    wakeTrigger.value = preferences.wakeTrigger || 'phrase';
    doubleClap.checked = preferences.doubleClapEnabled === true || wakeTrigger.value === 'sound';
    doubleClap.disabled = wakeTrigger.value === 'sound';
    screenSharing.checked = preferences.screenSharingEnabled === true;
    startupMusic.checked = preferences.startupMusicEnabled !== false;
    status(wakeStatus, wakeEnabled.checked ? (wakeTrigger.value === 'sound' ? 'sound ready' : 'phrase ready') : 'off', wakeEnabled.checked ? 'ok' : '');
    status(screenStatus, screenSharing.checked ? 'on' : 'off', screenSharing.checked ? 'ok' : '');
  }

  async function saveDesktopPreference(updates) {
    if (!desktop?.preferences?.set) throw new Error('Desktop controls require the installed GAI AI app');
    const preferences = await desktop.preferences.set(updates);
    syncDesktopStatus(preferences);
    return preferences;
  }

  wakeEnabled?.addEventListener('change', async () => {
    try { await desktop?.wake?.setConfig?.({ enabled: wakeEnabled.checked }); await saveDesktopPreference({ wakeEnabled: wakeEnabled.checked }); }
    catch (error) { setFeedback('gai-desktop-feedback', error.message, true); }
  });
  wakeTrigger?.addEventListener('change', async () => {
    try { await desktop?.wake?.setConfig?.({ trigger: wakeTrigger.value }); await saveDesktopPreference({ wakeTrigger: wakeTrigger.value }); }
    catch (error) { setFeedback('gai-desktop-feedback', error.message, true); }
  });
  doubleClap?.addEventListener('change', async () => {
    try { await desktop?.wake?.setConfig?.({ doubleClapEnabled: doubleClap.checked }); await saveDesktopPreference({ doubleClapEnabled: doubleClap.checked }); }
    catch (error) { setFeedback('gai-desktop-feedback', error.message, true); }
  });
  screenSharing?.addEventListener('change', async () => {
    try {
      const result = await desktop?.screen?.setEnabled?.(screenSharing.checked);
      await saveDesktopPreference({ screenSharingEnabled: result?.enabled === true });
      setFeedback('gai-desktop-feedback', screenSharing.checked ? 'Screen sharing is enabled. Capture remains manual.' : 'Screen sharing is off.');
    } catch (error) { setFeedback('gai-desktop-feedback', error.message, true); }
  });
  startupMusic?.addEventListener('change', async () => {
    try { await saveDesktopPreference({ startupMusicEnabled: startupMusic.checked }); }
    catch (error) { setFeedback('gai-desktop-feedback', error.message, true); }
  });
  document.getElementById('gai-attach-screen')?.addEventListener('click', async () => {
    try {
      const result = await desktop?.screen?.capture?.();
      if (!result?.ok) throw new Error(result?.error === 'screen_sharing_disabled' ? 'Turn on screen sharing first.' : result?.error || 'Screen capture failed');
      window.dispatchEvent(new CustomEvent('gai:attach-screen', { detail: result }));
      setFeedback('gai-desktop-feedback', 'Current screen attached to chat.');
    } catch (error) { setFeedback('gai-desktop-feedback', error.message, true); }
  });

  async function refreshReminders() {
    const root = document.getElementById('gai-reminder-list');
    if (!root) return;
    try {
      const { reminders = [] } = await json('/settings/reminders');
      root.replaceChildren();
      if (!reminders.length) {
        const empty = document.createElement('span'); empty.textContent = locale() === 'zh' ? '目前沒有待辦時間線。' : 'No pending timelines.'; root.appendChild(empty); return;
      }
      for (const reminder of reminders.slice(0, 20)) {
        const row = document.createElement('div'); row.className = 'gai-history-item';
        const copy = document.createElement('span'); copy.textContent = `${new Date(reminder.due_at).toLocaleString()} · ${reminder.task}`;
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '×'; cancel.title = 'Cancel';
        cancel.addEventListener('click', async () => { await post('/settings/reminders/cancel', { id: reminder.id }); await refreshReminders(); });
        row.append(copy, cancel); root.appendChild(row);
      }
    } catch (error) { setFeedback('gai-desktop-feedback', error.message, true); }
  }

  const reminderDue = document.getElementById('gai-reminder-due');
  if (reminderDue) {
    const suggested = new Date(Date.now() + 60 * 60 * 1000);
    suggested.setMinutes(Math.ceil(suggested.getMinutes() / 5) * 5, 0, 0);
    const localDate = new Date(suggested.getTime() - suggested.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    reminderDue.value = localDate;
    reminderDue.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  document.getElementById('gai-add-reminder')?.addEventListener('click', async () => {
    const taskInput = document.getElementById('gai-reminder-task');
    try {
      await post('/settings/reminders', { task: taskInput.value, dueAt: new Date(reminderDue.value).toISOString() });
      taskInput.value = '';
      setFeedback('gai-desktop-feedback', locale() === 'zh' ? '時間線已建立；到時會自動處理、通知並跟進。' : 'Timeline created. GAI AI will act, notify and follow up automatically.');
      await refreshReminders();
    } catch (error) { setFeedback('gai-desktop-feedback', error.message, true); }
  });
  document.getElementById('gai-refresh-reminders')?.addEventListener('click', refreshReminders);

  Promise.allSettled([
    json('/settings/map').then(({ map }) => { mapProvider.value = map?.provider || 'osm'; syncMapFields(); }),
    json('/settings/web-search').then(({ webSearch }) => { searchProvider.value = webSearch?.preferredEngine || 'auto'; }),
    json('/settings/voice').then(({ voice }) => { voiceProvider.value = voice?.voiceProvider || 'local'; voiceLanguage.value = localStorage.getItem('bailongma-voice-lang') || 'multilingual'; }),
    json('/settings/media-provider').then(({ media }) => {
      mediaProvider.value = media?.provider || 'local';
      document.getElementById('gai-media-baseurl').value = media?.openaiBaseURL || 'https://api.openai.com/v1';
      document.getElementById('gai-media-model').value = media?.openaiModel || 'gpt-image-1';
      document.getElementById('gai-media-sd-url').value = media?.stableDiffusionBaseURL || 'http://127.0.0.1:7860';
      videoProvider.value = media?.videoProvider || 'seedance';
      document.getElementById('gai-gemini-image-model').value = media?.geminiImageModel || 'gemini-3.1-flash-image';
      document.getElementById('gai-gemini-video-model').value = media?.geminiVideoModel || 'veo-3.1-lite-generate-preview';
      document.getElementById('gai-doubao-baseurl').value = media?.doubaoBaseURL || 'https://ark.cn-beijing.volces.com/api/v3';
      document.getElementById('gai-doubao-image-model').value = media?.doubaoImageModel || '';
      document.getElementById('gai-seedance-model').value = media?.seedance?.model || '';
      document.getElementById('gai-seedance-baseurl').value = media?.seedance?.baseURL || 'https://ark.cn-beijing.volces.com/api/v3';
      syncMediaFields();
    }),
  ]).catch(() => {});
  syncMediaFields();
  voiceLanguage.value = localStorage.getItem('bailongma-voice-lang') || 'multilingual';
  desktop?.preferences?.get?.().then(syncDesktopStatus).catch(() => syncDesktopStatus({ wakeEnabled: false }));
  desktop?.wake?.onStatus?.((payload) => status(wakeStatus, payload?.enabled === false ? 'off' : payload?.ready ? 'listening' : payload?.state || 'starting', payload?.ready ? 'ok' : ''));
  desktop?.onUpdaterStatus?.((payload) => status(updateStatus, payload?.stage || 'automatic', payload?.stage === 'downloaded' || payload?.stage === 'up-to-date' ? 'ok' : ''));
  refreshReminders();
  refreshDevices();
  detectLocalAI();
  refreshCodex();
}
