import crypto from 'node:crypto'
import os from 'node:os'
import { getAppVersion } from './version.js'

export const OFFLINE_SUPER_MODEL = 'gai-offline-super'
// Kept as an API alias so v2 modules and third-party integrations do not break.
export const OFFLINE_LITE_MODEL = OFFLINE_SUPER_MODEL

const HELP = {
  en: [
    'GAI Offline Super is ready. It needs no API key, account, payment or local model.',
    '',
    'Built-in local skills:',
    '• Date, time and system status',
    '• Safe calculator and unit conversion',
    '• Extractive summaries and text statistics',
    '• JSON validation / formatting',
    '• Password generation and checklists',
    '• Automatic Ollama / LM Studio discovery',
    '',
    'Examples: “convert 12 km to miles”, “summarize: …”, “format json: …”, “password 24”, “checklist: backup, test, deploy”.',
    'Connect a local model or sign in with ChatGPT through the official Codex Connector for open-ended reasoning.',
  ].join('\n'),
  zh: [
    'GAI Offline Super 已就绪，不需要 API Key、账号、充值或另外安装本地模型。',
    '',
    '内置本地能力：',
    '• 日期、时间与系统状态',
    '• 安全的基础计算器與單位換算',
    '• 提取式摘要与文字统计',
    '• JSON 校验／格式化',
    '• 密码生成与检查清单',
    '• 自动检测 Ollama／LM Studio',
    '',
    '例子：“12 公里换算英里”、“总结：……”、“格式化 JSON：……”、“生成24位密码”、“清单：备份、测试、发布”。',
    '需要开放式推理时，可连接本地模型，或通过官方 Codex Connector 登录 ChatGPT。',
  ].join('\n'),
}

const UNIT_ALIASES = new Map(Object.entries({
  mm: 'mm', millimeter: 'mm', millimeters: 'mm', 毫米: 'mm',
  cm: 'cm', centimeter: 'cm', centimeters: 'cm', 厘米: 'cm', 公分: 'cm',
  m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm', 米: 'm',
  km: 'km', kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km', 公里: 'km', 千米: 'km',
  in: 'in', inch: 'in', inches: 'in', 英寸: 'in',
  ft: 'ft', foot: 'ft', feet: 'ft', 英尺: 'ft',
  yd: 'yd', yard: 'yd', yards: 'yd', 码: 'yd',
  mi: 'mi', mile: 'mi', miles: 'mi', 英里: 'mi',
  mg: 'mg', milligram: 'mg', milligrams: 'mg', 毫克: 'mg',
  g: 'g', gram: 'g', grams: 'g', 克: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg', 公斤: 'kg', 千克: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz', 盎司: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb', 磅: 'lb',
  c: 'c', '°c': 'c', celsius: 'c', 摄氏: 'c', 摄氏度: 'c',
  f: 'f', '°f': 'f', fahrenheit: 'f', 华氏: 'f', 华氏度: 'f',
  k: 'k', kelvin: 'k', 开尔文: 'k',
  b: 'b', byte: 'b', bytes: 'b', 字节: 'b',
  kb: 'kb', mb: 'mb', gb: 'gb', tb: 'tb',
  sec: 'sec', second: 'sec', seconds: 'sec', 秒: 'sec',
  min: 'min', minute: 'min', minutes: 'min', 分钟: 'min', 分鐘: 'min',
  hr: 'hr', hour: 'hr', hours: 'hr', 小时: 'hr', 小時: 'hr',
  day: 'day', days: 'day', 天: 'day',
}))

const LINEAR_UNITS = {
  length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 },
  mass: { mg: 0.000001, g: 0.001, kg: 1, oz: 0.028349523125, lb: 0.45359237 },
  data: { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 },
  time: { sec: 1, min: 60, hr: 3600, day: 86400 },
}

function normalizeText(value) {
  return String(value || '').trim()
}

function languageOf(text) {
  return /[\u3400-\u9fff]/.test(String(text || '')) ? 'zh' : 'en'
}

function latestUserText(message, messages = []) {
  const direct = normalizeText(message)
  if (direct && direct !== 'TICK') return direct
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role !== 'user') continue
    const content = normalizeText(messages[i]?.content)
    if (content && !content.startsWith('[internal]')) return content
  }
  return direct
}

function tokenizeExpression(expression) {
  const input = String(expression || '').replace(/，/g, ',').replace(/×/g, '*').replace(/÷/g, '/')
  if (!input || input.length > 160) throw new Error('expression is empty or too long')
  const tokens = []
  let index = 0
  while (index < input.length) {
    const char = input[index]
    if (/\s/.test(char)) { index += 1; continue }
    if (/[+\-*/%^()]/.test(char)) { tokens.push(char); index += 1; continue }
    const number = input.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/)?.[0]
    if (!number) throw new Error(`unrecognized character “${char}”`)
    tokens.push(Number(number))
    index += number.length
  }
  return tokens
}

export function evaluateOfflineExpression(expression) {
  const tokens = tokenizeExpression(expression)
  let cursor = 0
  const peek = () => tokens[cursor]
  const take = () => tokens[cursor++]

  function primary() {
    const token = take()
    if (typeof token === 'number') return token
    if (token === '(') {
      const value = addSub()
      if (take() !== ')') throw new Error('missing closing parenthesis')
      return value
    }
    throw new Error('incomplete expression')
  }
  function unary() {
    if (peek() === '+') { take(); return unary() }
    if (peek() === '-') { take(); return -unary() }
    return primary()
  }
  function power() {
    let value = unary()
    if (peek() === '^') {
      take()
      const exponent = power()
      if (Math.abs(exponent) > 1000) throw new Error('exponent is too large')
      value **= exponent
    }
    return value
  }
  function mulDiv() {
    let value = power()
    while (['*', '/', '%'].includes(peek())) {
      const op = take()
      const right = power()
      if ((op === '/' || op === '%') && right === 0) throw new Error('cannot divide by zero')
      value = op === '*' ? value * right : op === '/' ? value / right : value % right
    }
    return value
  }
  function addSub() {
    let value = mulDiv()
    while (peek() === '+' || peek() === '-') {
      const op = take()
      const right = mulDiv()
      value = op === '+' ? value + right : value - right
    }
    return value
  }
  const result = addSub()
  if (cursor !== tokens.length) throw new Error('invalid expression')
  if (!Number.isFinite(result)) throw new Error('result is outside the supported range')
  return Number.isInteger(result) ? result : Number(result.toPrecision(12))
}

function extractCalculation(text) {
  const raw = normalizeText(text)
  const explicit = raw.match(/^(?:\/calc|calculate|calc|计算|計算|算一下|帮我算)\s*[:：]?\s*(.+)$/i)?.[1]
  if (explicit) return explicit.trim()
  if (/^[\d\s.+\-*/%^()×÷]+$/.test(raw) && /\d/.test(raw) && /[+\-*/%^×÷]/.test(raw)) return raw
  return ''
}

function normalizeUnit(value) {
  return UNIT_ALIASES.get(String(value || '').trim().toLowerCase()) || null
}

function unitFamily(unit) {
  if (['c', 'f', 'k'].includes(unit)) return 'temperature'
  return Object.entries(LINEAR_UNITS).find(([, table]) => unit in table)?.[0] || null
}

export function convertOfflineUnit(value, fromRaw, toRaw) {
  const from = normalizeUnit(fromRaw)
  const to = normalizeUnit(toRaw)
  if (!from || !to) throw new Error('unsupported unit')
  const family = unitFamily(from)
  if (!family || family !== unitFamily(to)) throw new Error('units are from different categories')
  const amount = Number(value)
  if (!Number.isFinite(amount)) throw new Error('invalid number')
  if (family === 'temperature') {
    const celsius = from === 'c' ? amount : from === 'f' ? (amount - 32) * 5 / 9 : amount - 273.15
    const result = to === 'c' ? celsius : to === 'f' ? celsius * 9 / 5 + 32 : celsius + 273.15
    return Number(result.toPrecision(12))
  }
  const result = amount * LINEAR_UNITS[family][from] / LINEAR_UNITS[family][to]
  return Number(result.toPrecision(12))
}

function extractConversion(text) {
  const cleaned = normalizeText(text)
    .replace(/^(?:convert|换算|換算|转换|轉換)\s*/i, '')
    .replace(/\s*(?:是多少|等于多少|等於多少)\??$/i, '')
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*([^\d\s]+)\s*(?:to|in|为|為|到|换成|換成|=|->)\s*([^\d\s]+)$/i)
  return match ? { value: Number(match[1]), from: match[2], to: match[3] } : null
}

function formatDateTime(now, lang) {
  const locale = lang === 'zh' ? 'zh-CN' : 'en-GB'
  const date = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(now)
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'
  return `${date}, ${time} (${timezone})`
}

export function summarizeOfflineText(source, maxSentences = 3) {
  const text = normalizeText(source)
  if (!text) return ''
  const sentences = text.split(/(?<=[.!?。！？])\s+|\n+/).map(s => s.trim()).filter(Boolean)
  if (sentences.length <= maxSentences) return sentences.join(' ')
  const words = text.toLowerCase().match(/[a-z0-9']{2,}|[\u3400-\u9fff]{1,4}/g) || []
  const stop = new Set(['the', 'and', 'that', 'this', 'with', 'from', 'have', 'will', 'your', 'about', 'then', 'into', 'there', 'their', '一个', '这个', '可以', '以及', '我们', '你们', '因为', '所以'])
  const freq = new Map()
  for (const word of words) if (!stop.has(word)) freq.set(word, (freq.get(word) || 0) + 1)
  return sentences
    .map((sentence, index) => {
      const tokens = sentence.toLowerCase().match(/[a-z0-9']{2,}|[\u3400-\u9fff]{1,4}/g) || []
      const score = tokens.reduce((sum, word) => sum + (freq.get(word) || 0), 0) / Math.max(6, tokens.length)
      return { sentence, index, score: score + (index === 0 ? 0.35 : 0) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map(item => item.sentence)
    .join(' ')
}

function generatePassword(length = 20) {
  const size = Math.max(12, Math.min(64, Number(length) || 20))
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+'
  const bytes = crypto.randomBytes(size)
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
}

function buildTextStats(text, lang) {
  const lines = text ? text.split(/\r?\n/).length : 0
  const words = text.match(/[A-Za-z0-9']+|[\u3400-\u9fff]/g)?.length || 0
  const chars = [...text].length
  return lang === 'zh' ? `字符：${chars} · 词／字：${words} · 行数：${lines}` : `Characters: ${chars} · Words: ${words} · Lines: ${lines}`
}

export function isOfflineFallbackError(error) {
  const status = Number(error?.status ?? error?.response?.status ?? 0)
  const message = normalizeText(error?.message || error).toLowerCase()
  if ([401, 402, 403, 408, 409, 429].includes(status) || status >= 500) return true
  return /insufficient[_\s-]*quota|quota|billing|payment|required|credit|balance|余额|配额|充值|rate.?limit|unauthori[sz]ed|invalid.*api.*key|authentication|network|fetch failed|timeout|econn|socket|service unavailable/.test(message)
}

export function buildOfflineReply({ message, messages = [], fallbackError = null, now = new Date() } = {}) {
  const text = latestUserText(message, messages)
  if (!text || text === 'TICK') return ''
  const lang = languageOf(text)
  const lower = text.toLowerCase()
  const prefix = fallbackError
    ? (lang === 'zh' ? '云端连接目前不可用，本轮已安全切换到 GAI Offline Super。\n\n' : 'The online connector is unavailable, so this turn switched safely to GAI Offline Super.\n\n')
    : ''

  if (/^(\/help|help|帮助|幫助|使用说明|使用說明|你能做什么|你能做什麼|功能)$/i.test(text)) return prefix + HELP[lang]
  if (/^(你好|您好|嗨|hi|hello|hey|早安|午安|晚安)[!！。,.，\s]*$/i.test(text)) {
    return prefix + (lang === 'zh' ? '你好，我是 GAI AI。Offline Super 已就绪，无需 Key 或本地模型；输入“帮助”查看内置能力。' : 'Hello, I’m GAI AI. Offline Super is ready with no key or local model; type “help” to see built-in skills.')
  }
  if (/几点|時間|时间|日期|几号|幾號|星期几|星期幾|\b(today|time|date)\b/.test(lower)) {
    return prefix + (lang === 'zh' ? `现在是 ${formatDateTime(now, lang)}。` : `It is ${formatDateTime(now, lang)}.`)
  }

  const expression = extractCalculation(text)
  if (expression) {
    try { return prefix + `${expression} = ${evaluateOfflineExpression(expression)}` }
    catch (error) { return prefix + (lang === 'zh' ? `计算失败：${error.message}。支持数字、括号与 + - * / % ^。` : `Calculation failed: ${error.message}. Supported operators: + - * / % ^.`) }
  }

  const conversion = extractConversion(text)
  if (conversion) {
    try {
      const result = convertOfflineUnit(conversion.value, conversion.from, conversion.to)
      return prefix + `${conversion.value} ${conversion.from} = ${result} ${conversion.to}`
    } catch (error) {
      return prefix + (lang === 'zh' ? `换算失败：${error.message}。` : `Conversion failed: ${error.message}.`)
    }
  }

  const summarySource = text.match(/^(?:summari[sz]e|summary|总结|總結|摘要)\s*[:：]\s*([\s\S]+)$/i)?.[1]
  if (summarySource) return prefix + summarizeOfflineText(summarySource, 3)

  const statsSource = text.match(/^(?:text stats|count text|文字统计|文字統計|字数统计|字數統計)\s*[:：]\s*([\s\S]+)$/i)?.[1]
  if (statsSource) return prefix + buildTextStats(statsSource, lang)

  const jsonSource = text.match(/^(?:format json|validate json|格式化\s*json|校验\s*json|校驗\s*json)\s*[:：]\s*([\s\S]+)$/i)?.[1]
  if (jsonSource) {
    try { return prefix + `\`\`\`json\n${JSON.stringify(JSON.parse(jsonSource), null, 2)}\n\`\`\`` }
    catch (error) { return prefix + (lang === 'zh' ? `JSON 无效：${error.message}` : `Invalid JSON: ${error.message}`) }
  }

  const passwordMatch = text.match(/^(?:generate\s+)?password(?:\s+(\d+))?$|^生成\s*(\d+)?\s*位?密码$/i)
  if (passwordMatch) {
    const length = Number(passwordMatch[1] || passwordMatch[2] || 20)
    return prefix + (lang === 'zh' ? `本地生成的强密码（${Math.max(12, Math.min(64, length))} 位）：\n\`${generatePassword(length)}\`` : `Locally generated strong password (${Math.max(12, Math.min(64, length))} characters):\n\`${generatePassword(length)}\``)
  }

  const checklistSource = text.match(/^(?:checklist|清单|清單)\s*[:：]\s*([\s\S]+)$/i)?.[1]
  if (checklistSource) {
    const items = checklistSource.split(/[,，;；\n]+/).map(item => item.trim()).filter(Boolean)
    if (items.length) return prefix + items.map(item => `- [ ] ${item}`).join('\n')
  }

  if (/什么模式|什麼模式|当前模式|當前模式|模型状态|模型狀態|运行状态|運行狀態|有没有联网|有沒有聯網|\b(mode|status|offline|system info)\b/.test(lower)) {
    const memoryGb = (os.totalmem() / 1024 ** 3).toFixed(1)
    return prefix + (lang === 'zh'
      ? `GAI AI v${getAppVersion()} 正在以 ${OFFLINE_SUPER_MODEL} 运行。系统：${os.platform()} ${os.arch()}，内存 ${memoryGb} GB。当前模式不会调用付费模型。`
      : `GAI AI v${getAppVersion()} is running ${OFFLINE_SUPER_MODEL} on ${os.platform()} ${os.arch()} with ${memoryGb} GB RAM. This mode does not call a paid model.`)
  }

  return prefix + (lang === 'zh'
    ? '我已收到消息。当前是无需模型的 GAI Offline Super；这条开放式问题超出确定性本地工具的可靠范围。输入“帮助”查看离线能力，或登录 ChatGPT／连接本地模型获得开放式推理。'
    : 'Message received. GAI Offline Super runs without a model, but this open-ended request is outside its deterministic local skills. Type “help”, or sign in with ChatGPT / connect a local model for open-ended reasoning.')
}

export async function createOfflineStreamResult({ message, messages, fallbackError, onStream, now, enabled = true } = {}) {
  if (!enabled) return { content: '', reasoningContent: '', aborted: false, toolCalls: [] }
  const content = buildOfflineReply({ message, messages, fallbackError, now })
  if (content) {
    onStream?.({ event: 'start', mode: 'text' })
    onStream?.({ event: 'chunk', text: content })
    onStream?.({ event: 'end', mode: 'text' })
  }
  return { content, reasoningContent: '', aborted: false, toolCalls: [] }
}
