export const UI_LANGUAGE_KEY = 'gai-ui-language'

const EN = new Map(Object.entries({
  '主题': 'Theme', 'AI 名字': 'AI name', '显示名': 'Display name', '保存': 'Save', '保存所有': 'Save all',
  '记忆节点图': 'Memory graph', '显示记忆节点图': 'Show memory graph', '当前状态': 'Current status', '媒体': 'Media',
  '切换配置': 'Switch configuration', '提供商': 'Provider', '服务商': 'Provider', '自动识别': 'Auto detect',
  'GAI Offline Super（无需 Key）': 'GAI Offline Super (no key)', 'OpenAI Codex（ChatGPT 登录，无需 API Key）': 'OpenAI Codex (ChatGPT sign-in, no API key)',
  '小米 MiMo': 'Xiaomi MiMo', '自定义端点（本地/其他）': 'Custom endpoint (local/other)', '模型': 'Model',
  '自定义模型名': 'Custom model name', '模型名称': 'Model name', '模型温度': 'Model temperature',
  '思考模式': 'Reasoning mode', '启用思考模式': 'Enable reasoning mode', '飞书': 'Feishu', '微信公众号': 'WeChat Official Account',
  '企业微信': 'WeCom', '微信 ClawBot（个人微信）': 'WeChat ClawBot (personal account)', '○ 未连接': '○ Not connected',
  '连接微信': 'Connect WeChat', '断开': 'Disconnect', '用微信扫描下方二维码：': 'Scan the QR code with WeChat:',
  '等待扫码…': 'Waiting for scan…', '语音识别配置': 'Speech recognition', '粘贴 Key 自动识别厂商': 'Paste a key to detect provider',
  'Windows / macOS 本機識別（默認）': 'Windows / macOS native (default)', '阿里云百炼（推荐）': 'Alibaba Cloud Bailian (recommended)',
  '火山引擎豆包 ASR': 'Volcengine Doubao ASR', '腾讯云 ASR': 'Tencent Cloud ASR', '科大讯飞 RTASR': 'iFlytek RTASR',
  '阿里云 API Key': 'Alibaba Cloud API key', '语音识别灵敏度': 'Speech recognition sensitivity', '触发阈值': 'Activation threshold',
  '语音合成（TTS）': 'Text-to-speech (TTS)', '系統內建語音（免費／預設）': 'System voice (free / default)',
  '豆包（雲端，可能收費）': 'Doubao (cloud, may charge)', 'OpenAI TTS（雲端，可能收費）': 'OpenAI TTS (cloud, may charge)',
  'ElevenLabs（雲端，可能收費）': 'ElevenLabs (cloud, may charge)', '火山引擎（雲端，可能收費）': 'Volcengine (cloud, may charge)',
  'MiniMax（雲端，可能收費）': 'MiniMax (cloud, may charge)', '声音': 'Voice', '流式合成': 'Streaming synthesis',
  '机器人音效': 'Robot voice effect', '机器人音效需要付费，这是维持这个项目动力，请联系作者索要密码': 'Robot voice effects require a paid unlock. Contact the author for the password.',
  '解锁': 'Unlock', '混响': 'Reverb', '混响长度': 'Reverb length', '失真 / 重量': 'Distortion / weight', '金属感': 'Metallic tone',
  '机器人感': 'Robot tone', '合成厚度': 'Chorus depth', '金属共振': 'Metal resonance', '金属音调': 'Metal pitch',
  '机器人音调': 'Robot pitch', '恢复默认': 'Restore defaults', '语速': 'Speech rate', '试听': 'Test voice',
  '设备设置': 'Device settings', '识别语言': 'Recognition language', '中文 + English（雙語／預設）': 'Chinese + English (bilingual / default)',
  '中文（普通话）': 'Chinese (Mandarin)', '麦克风': 'Microphone', '系统默认麦克风': 'System default microphone', '刷新': 'Refresh',
  '输出设备': 'Audio output', '自动（跟随系统，避开虚拟设备）': 'Automatic (follow system, avoid virtual devices)',
  '识别后自动发送': 'Send automatically after recognition', '启动时自动开启麦克风': 'Enable microphone on startup',
  '搜索引擎': 'Search engine', '当前状态': 'Current status', '文件沙箱': 'File sandbox', '启用文件沙箱': 'Enable file sandbox',
  '命令执行沙箱': 'Command execution sandbox', '启用执行沙箱': 'Enable execution sandbox', '工具黑名单': 'Tool blocklist',
  '局域网访问': 'Local network access', '允许局域网访问': 'Allow local network access', '立即重启': 'Restart now',
  '心跳 · 思考 · 工具': 'Heartbeat · reasoning · tools', '自主行动机制 · Tick': 'Autonomous action · Tick',
  '节点': 'Nodes', '引力': 'Gravity', '斥力': 'Repulsion', '节点大小': 'Node size', 'Token流': 'Token stream',
  '流式传输': 'Streaming', '抽取/h': 'Extraction/h', '召回/h': 'Recall/h', '连线': 'Links',
  '我的語音樣本': 'My voice sample', '錄製 6 秒語音樣本': 'Record a 6-second voice sample', '樣本只保存在此裝置。': 'The sample stays on this device.',
  '預設使用作業系統內建語音，免費且無需金鑰。雲端語音為選配；若不可用會自動回退到系統語音。': 'The free system voice is the default and needs no key. Cloud voices are optional and fall back to the system voice if unavailable.',
  '紅色選項可能產生第三方費用；GAI AI 不會在未選擇及未配置時呼叫付費 TTS。': 'Red options may incur third-party charges. GAI AI never calls paid TTS unless you select and configure it.',
  '付費聲音克隆服務並未自動啟用；本機樣本不會上傳。若日後選擇第三方克隆模型，必須另外確認費用與隱私條款。': 'Paid voice cloning is not enabled automatically and the local sample is not uploaded. Confirm pricing and privacy separately before using any third-party cloning model.',
  '开启后在背景显示记忆节点力导向图，会占用额外 CPU/GPU 资源，低配设备建议关闭。修改后需刷新页面生效。': 'Shows a force-directed memory graph in the background. It uses extra CPU/GPU; refresh after changing this setting.',
  '控制回复的随机性。0 = 确定性最高，1 = 正常创意，1.5 = 更随机。推荐 0.3–0.7。': 'Controls response randomness. 0 is deterministic, 1 is normally creative, and 1.5 is more random. Recommended: 0.3–0.7.',
  '默认关闭：直接作答，响应更快、更省 token。开启后模型会先推理再回答，复杂任务更可靠（具体想多深由模型自己决定），但响应更慢。遇到难题想要更高质量时再开启。': 'Off by default for faster, lower-token replies. Enable it for deeper reasoning on complex tasks at the cost of speed.',
  '点击「连接微信」后会生成二维码，用微信扫码即可绑定个人账号。凭证保存在本地，重启后无需重新扫码。': 'Click Connect WeChat to create a QR code. Credentials stay local, so a restart does not require another scan.',
  '调节麦克风触发阈值。越低越灵敏，越高越需要大声说话。默认 0.008。': 'Adjust the microphone trigger threshold. Lower is more sensitive; higher requires louder speech. Default: 0.008.',
  '边合成边播放，回复更快出声（默认开）': 'Play while synthesizing for faster voice feedback (on by default)',
  '给当前声音叠加混响 / 机械质感（默认关）': 'Add reverb / mechanical texture to the current voice (off by default)',
  '拖动即时生效，下次播放 / 试听可听到': 'Changes apply immediately to the next playback or test',
  '更换麦克风后，重新开启语音对话生效。': 'Restart voice conversation after changing the microphone.',
  '语音从这里发声。默认自动选择；拔耳机会自动切回扬声器，不会被串流/虚拟声卡占用。': 'Speech plays here. Automatic routing returns to speakers when headphones disconnect and avoids virtual audio devices.',
  'Agent 调用 web_search 时分两梯队：第一梯队（带 key 的 API：Serper → Brave → Tavily → SearXNG）按优先级尝试；都没结果时，第二梯队（Bing / Jina / DuckDuckGo，无需配置）并行兜底。配任意一个 key 都能显著提升质量和稳定性，多配几个可避免单一额度用尽时搜索失败。': 'Web search first tries configured APIs in order (Serper, Brave, Tavily, SearXNG), then falls back in parallel to Bing, Jina, and DuckDuckGo. Adding one or more keys improves reliability.',
  '开启后文件读写只允许在 sandbox/ 目录内。关闭后 Agent 可操作系统任意位置的文件，请谨慎使用。': 'Restricts file access to sandbox/. If disabled, the Agent can access files anywhere on the system.',
  '开启后 exec_command 工作目录锁定在 sandbox/，且禁止使用绝对路径和父目录引用。关闭后命令可访问系统任意目录。': 'Locks command execution to sandbox/ and blocks absolute and parent paths. If disabled, commands can access any system directory.',
  '勾选后该工具将被拒绝执行，对话中 Agent 调用时会收到"已被安全策略禁用"错误。': 'Checked tools are blocked and return a security-policy error to the Agent.',
  '允許同一局域網內的設備訪問本機 GAI AI API。開啟或關閉後需要重啟應用生效。': 'Allow devices on the same local network to access this GAI AI API. Restart after changing this setting.',
  '可用声音：nova · shimmer · alloy · echo · fable · onyx': 'Voices: nova · shimmer · alloy · echo · fable · onyx',
  '可用声音：male-qn-qingse · male-qn-jingying · female-shaonv · female-yujie · presenter_female 等。': 'Voices include male-qn-qingse, male-qn-jingying, female-shaonv, female-yujie, and presenter_female.',
  '可用声音：BV001_streaming（通用女声）· BV002_streaming（通用男声）等，在火山引擎控制台查看全部。': 'Voices include BV001_streaming and BV002_streaming. See the Volcengine console for all voices.',
  '免费套餐每月 10,000 字符。声音 ID 在 ElevenLabs 控制台获取。': 'The free tier includes 10,000 characters per month. Find voice IDs in the ElevenLabs console.',
  '选填。自托管 SearXNG 实例地址（去隐私的元搜索引擎）。要带 http:// 或 https://。': 'Optional self-hosted SearXNG URL. Include http:// or https://.',
  '在': 'At', '获取（有免费额度）。s.jina.ai 搜索接口，第二梯队兜底之一。': ' provides a free allowance and serves as a fallback search source.',
  '获取（每月 1000 次免费）。面向 LLM 的搜索接口。': ' offers 1,000 free searches monthly and is optimized for LLMs.',
  '获取（每月 2000 次免费）。独立索引，Serper 的可靠兜底。': ' offers 2,000 free searches monthly and is a reliable independent fallback.',
  '注册后获取（每月 2500 次免费）。Google SERP JSON 接口，最稳定。': 'Register for 2,500 free monthly requests to the reliable Google SERP JSON API.',
  '（HTTP 请求）': '(HTTP requests)', '（执行 shell 命令）': '(run shell commands)', '（网页搜索）': '(web search)',
  '（浏览器渲染访问）': '(browser-rendered access)', '（投影声明式界面 surface）': '(render declarative UI surfaces)',
  '状态': 'Status', '中文': 'Chinese', 'Amap / 高德': 'Amap', '中文 + English (default)': 'Chinese + English (default)',
  '豆包语音合成控制台': 'Doubao TTS console', '获取 API Key。2.0 音色使用 seed-tts-2.0；1.0/moon/BV 音色使用 seed-tts-1.0 或控制台对应资源。': 'Get an API key. 2.0 voices use seed-tts-2.0; 1.0/moon/BV voices use seed-tts-1.0 or the matching console resource.',
  'Base URL（选填）': 'Base URL (optional)', '地图服务': 'Map service',
  '为台风监测、位置、行程等功能提供统一真实地图。凭证仅保存在本机加密存储中，不会写入项目源码或返回安全密钥明文。': 'Provides one real map service for typhoons, locations, trips, and related features. Credentials stay in encrypted local storage and are never written to source code or returned in plaintext.',
  '正在检查…': 'Checking…', '地图服务商': 'Map provider', 'OpenStreetMap（无需 Key）': 'OpenStreetMap (no key)',
  '高德地图 JS API 2.0': 'Amap JS API 2.0', 'Web 端 Key': 'Browser key', '安全密钥': 'Security key',
  '请在高德开放平台创建“Web端（JS API）”Key。安全密钥只在本地代理请求中使用，地图页面无法读取其明文。': 'Create a Web (JS API) key in the Amap console. The security key is used only by the local proxy and is never exposed to map pages.',
  '保存地图配置': 'Save map settings', '清除': 'Clear', '申请高德 Key ↗': 'Get Amap key ↗', '申请 Google Key ↗': 'Get Google key ↗',
  '共用范围': 'Shared scope', '配置一次后，台风监测、天气灾害、位置卡片和后续地图页面都会通过统一 MapService 使用同一地图服务。': 'Configure once; typhoon monitoring, weather hazards, location cards, and future map pages all use the same MapService.',
  '版本信息': 'Version information', '当前版本': 'Current version', '未检查': 'Not checked', '检查更新': 'Check for updates',
  '立即下载': 'Download now', '立即重启安装': 'Restart and install', '忽略此版本': 'Ignore this version', '通知偏好': 'Notification preference',
  '不再提醒更新': 'Do not notify about updates', '开启后发现新版本时不会弹出提示卡片，仍可在此处手动检查。': 'When enabled, new versions do not show a notification card. You can still check manually here.',
  '已忽略的版本': 'Ignored version', '清除忽略': 'Clear ignored version', '视频': 'Video', '无视频源': 'No video source',
  'AI 视频生成': 'AI video generation', '+ 新视频': '+ New video', '生成栏 · QUEUE': 'Generation queue', '↓ 下载': '↓ Download',
  '暂无资源': 'No resources yet', '在下方输入提示词或加图，点“生成”': 'Enter a prompt or add images below, then click Generate',
  '文生视频': 'Text to video', '不加图 = 文生视频 · 1 张 = 图生视频 · 2 张 = 首尾帧': 'No image = text-to-video · 1 image = image-to-video · 2 images = first/last frames',
  '适配图片': 'Match image', '生成': 'Generate', '音乐': 'Music', '— 无歌词 —': '— No lyrics —', '图片': 'Image', '无图片源': 'No image source',
  '热点追踪 v2.7.1': 'Trend Monitor v2.7.1', '系统在线': 'System online', '实时舆情监测平台': 'Real-time public sentiment monitor',
  '全球热点事件追踪系统': 'Global trend event tracking system', '卫星链路': 'Satellite link', '在线': 'Online', '数据源': 'Data sources',
  '稳定': 'Stable', 'AI分析引擎': 'AI analysis engine', '运行中': 'Running', '● 实时': '● Live', '全球预警事件': 'Global alert events',
  '较前15分钟 ↑2': '↑2 vs. 15 minutes ago', '高关注度事件': 'High-attention events', '较前15分钟 ↑6': '↑6 vs. 15 minutes ago',
  '信息源总量': 'Total sources', '实时数据流/分钟': 'Live data streams/min', 'AI 分析置信度': 'AI analysis confidence', '模型状态：稳定': 'Model status: stable',
  '抖音': 'Douyin', '热榜': 'Trending', '刚刚更新': 'Updated just now', '小红书': 'Xiaohongshu', '全球热力图': 'Global heatmap',
  '拖拽旋转 · 滚轮缩放': 'Drag to rotate · scroll to zoom', '区域关注度': 'Regional attention', '实时排名': 'Live ranking',
  '亚太地区': 'Asia Pacific', '北美地区': 'North America', '欧洲地区': 'Europe', '中东地区': 'Middle East', '南美地区': 'South America',
  '非洲地区': 'Africa', '情绪指数': 'Sentiment index', '实时指标': 'Live metric', '中性偏热': 'Neutral to warm', '微信热点': 'WeChat trends',
  '热点榜': 'Trending', '微博': 'Weibo', '热搜榜': 'Hot searches', '实时': 'Live', '实时事件流': 'Live event stream',
  '24/7 全球热点持续追踪': '24/7 global trend tracking', '自动滚动中': 'Auto-scrolling', '人': 'Person', '人物档案': 'Person profile',
  '人物卡片': 'Person card', '等待选择人物': 'Waiting for a person', '当你不认识某位公众人物时，Longma 会在这里弹出一张简短人物卡片。': 'When you do not recognize a public figure, GAI AI shows a short person card here.',
  '识别点': 'Identifying points', '来源：待机': 'Source: standby', '配置说明': 'Configuration guide', '语音配置指南': 'Voice setup guide',
  '正在加载文档...': 'Loading document…', '● 文档已注入上下文 · 可直接告诉 Agent 你遇到的问题': '● Document added to context · tell the Agent what problem you are facing',
  '上下文有效期 30 分钟': 'Context remains active for 30 minutes',
  '○ 未配置': '○ Not configured', '● 已配置': '● Configured', '下次刷新页面后生效': 'Applies after the next refresh',
  '保存后，重新开启语音对话生效。': 'Saved. Restart voice conversation to apply.', '保存失败': 'Save failed',
  '地图服务已启用': 'Map service enabled', '地图配置已清除': 'Map settings cleared', '失败 — 请检查配置和 API Key': 'Failed — check settings and API key',
  '已保存 — 立即生效': 'Saved — active now', '已保存 — 重启后生效': 'Saved — active after restart', '已保存': 'Saved',
  '已保存，请补全配置': 'Saved; complete the remaining settings', '已关闭 — 下一轮生效': 'Disabled — applies next turn',
  '已切换，立即生效。': 'Switched — active now.', '已开启 — 下一轮生效': 'Enabled — applies next turn', '已清除': 'Cleared',
  '已自动保存': 'Saved automatically', '已设为自动，立即生效。': 'Set to automatic — active now.',
  '当前环境不支持指定输出设备，将使用系统默认。': 'This environment cannot select an output device; using the system default.',
  '当前环境不支持麦克风设备枚举，将使用系统默认麦克风。': 'This environment cannot list microphones; using the system default.',
  '播放中': 'Playing', '未检测到独立扬声器/耳机，点刷新并授权后可显示。': 'No separate speaker/headset detected. Refresh and grant access to list devices.',
  '未检测到独立麦克风，将使用系统默认麦克风。': 'No separate microphone detected; using the system default.',
  '未获得麦克风权限，仍可使用系统默认麦克风；点刷新可重新授权。': 'Microphone access was not granted. The system default still works; refresh to request access again.',
  '未识别': 'Not recognized', '未配置（兜底链中跳过）': 'Not configured (skipped in fallback chain)', '正在重启…': 'Restarting…',
  '清除失败': 'Clear failed', '火山豆包 ASR': 'Volcengine Doubao ASR', '点刷新并授权后可显示设备完整名称。': 'Refresh and grant access to show full device names.',
  '科大讯飞': 'iFlytek', '腾讯云 ASR': 'Tencent Cloud ASR', '自动': 'Automatic', '自动保存失败': 'Automatic save failed',
  '语音从这里发声。默认自动；拔耳机会自动切回扬声器，不被虚拟声卡占用。': 'Speech plays here. Automatic routing returns to speakers when headphones disconnect and avoids virtual devices.',
  '语音输出设备': 'Voice output device', '请求失败': 'Request failed', '请输入 Key 或安全密钥': 'Enter a key or security key',
  '读取配置失败': 'Failed to load settings', '输出设备列表读取失败，将使用系统默认。': 'Failed to list output devices; using the system default.',
  '重启请求失败，请手动重启应用': 'Restart request failed; restart the app manually', '阿里云 ASR': 'Alibaba Cloud ASR',
  '麦克风列表读取失败，将使用系统默认麦克风。': 'Failed to list microphones; using the system default.', '（虚拟，可能没声音）': '(virtual, may be silent)',
  '高德地图': 'Amap', '手动输入模型名…': 'Enter model name manually…',
  '尚未錄製；樣本只保存在此裝置。': 'Not recorded yet; the sample stays on this device.',
  '正在保存到本機…': 'Saving locally…', '錄音中…請自然說一段中英文。最多 6 秒。': 'Recording… Speak naturally in Chinese and English for up to 6 seconds.',
  '停止並保存': 'Stop and save',
}))

const ATTR_EN = new Map(Object.entries({
  '视频模式 (V)': 'Video mode (V)', '音乐模式 (M)': 'Music mode (M)',
  '近 1 小时记忆召回次数 / 平均拉取条数。点击查看明细': 'Memory recalls in the last hour / average items retrieved. Click for details.',
  '近 1 小时记忆抽取次数 / 平均写入条数。点击查看明细': 'Memory extractions in the last hour / average items stored. Click for details.',
  '命令': 'Commands', '如 kimi-k2.8, gpt-5.2, glm-6': 'e.g. kimi-k2.8, gpt-5.2, glm-6',
  '留空则不修改': 'Leave blank to keep the saved value', '留空保持原值…': 'Leave blank to keep the saved value…',
  '留空则不修改（可与 LLM 共用）': 'Leave blank to keep the saved value (can share the LLM key)',
  '自定义端点，如 https://api.deepseek.com': 'Custom endpoint, e.g. https://api.deepseek.com',
  '留空保持现有 Key 不变': 'Leave blank to keep the current key', 'securityJsCode，留空保持不变': 'securityJsCode; leave blank to keep it',
  '留空保持原值不变…': 'Leave blank to keep the saved value…', '已保存的 Key 会在这里显示': 'The saved key is shown here',
  '输入密码解锁': 'Enter password to unlock', '显示 API Key': 'Show API key', '显示/隐藏 API Key': 'Show/hide API key',
  '阿里云 / 腾讯云 / 讯飞 / 火山豆包 ASR Key': 'Alibaba / Tencent / iFlytek / Volcengine ASR key',
  '如 http://localhost:11434/v1': 'e.g. http://localhost:11434/v1', '如 llama3.2, qwen2.5, mistral': 'e.g. llama3.2, qwen2.5, mistral',
  '填入 MiniMax API Key…': 'Enter MiniMax API key…', '微信二维码': 'WeChat QR code', '腾讯云 AppId': 'Tencent Cloud AppId',
  '讯飞 AppId': 'iFlytek AppId', '输入后自动保存': 'Saves automatically after entry', '火山引擎 TTS AppId': 'Volcengine TTS AppId',
  '自动匹配，或填 seed-tts-2.0 / seed-tts-1.0': 'Auto, or enter seed-tts-2.0 / seed-tts-1.0',
  '关闭视频': 'Close video', '视频播放器': 'Video player', '清空输入': 'Clear input', '关闭 (Esc)': 'Close (Esc)',
  '描述你想要的画面、动作、镜头运动、光线、风格…（Ctrl+Enter 生成）': 'Describe the scene, action, camera movement, lighting, and style… (Ctrl+Enter to generate)',
  '画面比例': 'Aspect ratio', '分辨率': 'Resolution', '时长（秒）': 'Duration (seconds)',
  '退出音乐模式': 'Exit music mode', '上一首': 'Previous track', '播放/暂停': 'Play/pause', '下一首': 'Next track', '音量': 'Volume',
  '关闭图片': 'Close image', '切换左面板': 'Toggle left panel', '切换右面板': 'Toggle right panel',
  '切换左面板 [ ': 'Toggle left panel [ ', '切换右面板 ] ': 'Toggle right panel ] ', '忽略': 'Dismiss',
  '关闭人物卡片': 'Close person card', '台风实时监测大屏': 'Live typhoon dashboard', '关闭台风监测': 'Close typhoon monitor',
  '世界杯赛况大屏': 'World Cup dashboard', '关闭世界杯模式': 'Close World Cup mode', '关闭': 'Close',
  'App ID（cli_ 开头）': 'App ID (starts with cli_)', '关闭热点模式': 'Close trend monitor', '上一条': 'Previous item', '下一条': 'Next item',
  '（已配置，留空不修改）': '(configured; leave blank to keep it)', '关闭文档面板': 'Close document panel',
}))

const originalText = new WeakMap()
const lastAppliedText = new WeakMap()
const originalAttrs = new WeakMap()
let applying = false

export function translateStaticUiText(value, language = 'en') {
  const text = String(value || '').trim()
  if (language !== 'en') return text
  const exact = EN.get(text)
  if (exact) return exact
  const replacements = [
    [/^已检测到 (\d+) 个麦克风。更换后重新开启语音对话生效。$/, 'Detected $1 microphones. Restart voice conversation after changing devices.'],
    [/^已检测到 (\d+) 个麦克风；点刷新并授权后可显示完整名称。$/, 'Detected $1 microphones. Refresh and grant access to show full names.'],
    [/^当前麦克风：(.+)。重新开启语音对话生效。$/, 'Current microphone: $1. Restart voice conversation to apply.'],
    [/^输出设备 (\d+)$/, 'Output device $1'], [/^麦克风 (\d+)$/, 'Microphone $1'],
    [/^(.+) · 已配置$/, '$1 · configured'], [/^(.+) · 尚未完成配置$/, '$1 · incomplete'],
    [/^● 部分配置 \((\d+)\/(\d+)\)$/, '● Partially configured ($1/$2)'], [/^已设为 ([\d.]+)$/, 'Set to $1'],
    [/^已保存本機語音樣本 (.+)$/, 'Local voice sample saved $1'],
    [/^保存失敗：(.+)$/, 'Save failed: $1'], [/^無法使用系統麥克風：(.+)$/, 'Cannot use the system microphone: $1'],
  ]
  for (const [pattern, replacement] of replacements) if (pattern.test(text)) return text.replace(pattern, replacement)
  return ''
}

export function translateStaticUiAttr(value, language = 'en') {
  const text = String(value || '')
  return language === 'en' ? (ATTR_EN.get(text) || '') : text
}

function translateText(root, language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (const node of nodes) {
    if (node.parentElement?.closest('.msg, #chat-stream, textarea, [data-en][data-zh]')) continue
    const current = node.nodeValue
    const trimmed = current.trim()
    if (!trimmed) continue
    if (!originalText.has(node) || (lastAppliedText.has(node) && current !== lastAppliedText.get(node))) originalText.set(node, current)
    const source = originalText.get(node)
    const sourceTrimmed = source.trim()
    const translated = translateStaticUiText(sourceTrimmed, 'en')
    const target = language === 'en' && translated
      ? source.replace(sourceTrimmed, translated)
      : source
    if (node.nodeValue !== target) node.nodeValue = target
    lastAppliedText.set(node, target)
  }
}

function translateAttrs(root, language) {
  for (const el of [root, ...root.querySelectorAll('[placeholder],[title],[aria-label],[alt]')]) {
    const originals = originalAttrs.get(el) || {}
    for (const name of ['placeholder', 'title', 'aria-label', 'alt']) {
      if (!el.hasAttribute?.(name)) continue
      if (!(name in originals)) originals[name] = el.getAttribute(name)
      const source = originals[name]
      const target = language === 'en' ? (translateStaticUiAttr(source, 'en') || source) : source
      if (el.getAttribute(name) !== target) el.setAttribute(name, target)
    }
    originalAttrs.set(el, originals)
  }
}

export function currentUiLocale() {
  return localStorage.getItem(UI_LANGUAGE_KEY) === 'zh' ? 'zh' : 'en'
}

export function applyUiLocale(language = currentUiLocale()) {
  const lang = language === 'zh' ? 'zh' : 'en'
  applying = true
  localStorage.setItem(UI_LANGUAGE_KEY, lang)
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  document.querySelectorAll('[data-en][data-zh]').forEach(el => {
    const target = el.dataset[lang] || el.dataset.en
    if (el.textContent !== target) el.textContent = target
  })
  if (document.body) { translateText(document.body, lang); translateAttrs(document.body, lang) }
  const input = document.getElementById('msg-input')
  if (input && !input.value) input.placeholder = lang === 'zh'
    ? '向 GAI AI 發送消息…（輸入 / 調出命令，Shift+Enter 換行）'
    : 'Message GAI AI… (/ commands, Shift+Enter for a new line)'
  applying = false
  window.dispatchEvent(new CustomEvent('gai:locale-change', { detail: { language: lang } }))
}

export function initUiLocale() {
  applyUiLocale(currentUiLocale())
  if (!document.body) return
  let scheduled = false
  new MutationObserver(mutations => {
    if (applying || scheduled) return
    const relevant = mutations.some(mutation => {
      const element = mutation.target.nodeType === Node.TEXT_NODE ? mutation.target.parentElement : mutation.target
      return !element?.closest?.('.msg, #chat-stream, #chat-history, .thought-stream, textarea')
    })
    if (!relevant) return
    scheduled = true
    queueMicrotask(() => { scheduled = false; applyUiLocale(currentUiLocale()) })
  }).observe(document.body, { subtree: true, childList: true, characterData: true })
}
