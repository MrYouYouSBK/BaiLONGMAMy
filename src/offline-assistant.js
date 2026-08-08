import os from 'node:os'
import { getAppVersion } from './version.js'

export const OFFLINE_LITE_MODEL = 'offline-lite'

const HELP_TEXT = [
  '我现在以离线基础模式运行，不需要 API Key、充值或另外安装模型。',
  '',
  '当前可直接使用：',
  '• 时间与日期：例如“现在几点”“今天几号”',
  '• 基础计算：例如“计算 (1250+88)*3”',
  '• 运行状态：例如“当前是什么模式”',
  '• 使用说明：输入“帮助”或 /help',
  '',
  '开放式问答、复杂推理和自动工具规划仍需要在设置中接入 GPT／DeepSeek，或连接本地 Ollama。云端余额不足时，应用会自动回到本模式，不会停止运行。',
].join('\n')

function normalizeText(value) {
  return String(value || '').trim()
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
  if (!input || input.length > 160) throw new Error('表达式为空或过长')
  const tokens = []
  let index = 0
  while (index < input.length) {
    const char = input[index]
    if (/\s/.test(char)) {
      index += 1
      continue
    }
    if (/[+\-*/%^()]/.test(char)) {
      tokens.push(char)
      index += 1
      continue
    }
    const number = input.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/)?.[0]
    if (!number) throw new Error(`无法识别“${char}”`)
    tokens.push(Number(number))
    index += number.length
  }
  return tokens
}

export function evaluateOfflineExpression(expression) {
  const tokens = tokenizeExpression(expression)
  let cursor = 0

  function peek() { return tokens[cursor] }
  function take() { return tokens[cursor++] }

  function primary() {
    const token = take()
    if (typeof token === 'number') return token
    if (token === '(') {
      const value = addSub()
      if (take() !== ')') throw new Error('缺少右括号')
      return value
    }
    throw new Error('表达式不完整')
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
      if (Math.abs(exponent) > 1000) throw new Error('指数过大')
      value **= exponent
    }
    return value
  }

  function mulDiv() {
    let value = power()
    while (['*', '/', '%'].includes(peek())) {
      const op = take()
      const right = power()
      if ((op === '/' || op === '%') && right === 0) throw new Error('不能除以零')
      if (op === '*') value *= right
      else if (op === '/') value /= right
      else value %= right
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
  if (cursor !== tokens.length) throw new Error('表达式格式不正确')
  if (!Number.isFinite(result)) throw new Error('结果超出可计算范围')
  return Number.isInteger(result) ? result : Number(result.toPrecision(12))
}

function extractCalculation(text) {
  const raw = normalizeText(text)
  const explicit = raw.match(/^(?:\/calc|计算|算一下|帮我算)\s*[:：]?\s*(.+)$/i)?.[1]
  if (explicit) return explicit.trim()
  if (/^[\d\s.+\-*/%^()×÷]+$/.test(raw) && /\d/.test(raw) && /[+\-*/%^×÷]/.test(raw)) return raw
  return ''
}

function formatDateTime(now = new Date()) {
  const date = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  }).format(now)
  const time = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'
  return `${date}，${time}（${timezone}）`
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
  const lower = text.toLowerCase()
  const fallbackPrefix = fallbackError
    ? '云端模型目前不可用（可能是余额、配额、凭证或网络问题），本轮已自动切换到离线基础模式。\n\n'
    : ''

  if (/^(\/help|help|帮助|使用说明|你能做什么|有什么功能|功能)$/i.test(text)) {
    return fallbackPrefix + HELP_TEXT
  }

  if (/^(你好|您好|嗨|hi|hello|hey|在吗|早安|午安|晚安)[!！。,.，\s]*$/i.test(text)) {
    return fallbackPrefix + '你好，我已正常运行。当前是离线基础模式，不需要 API Key 或本地模型。输入“帮助”可以查看现在能直接使用的功能。'
  }

  if (/几点|时间|日期|几号|星期几|today|time|date/.test(lower)) {
    return fallbackPrefix + `现在是 ${formatDateTime(now)}。`
  }

  const expression = extractCalculation(text)
  if (expression) {
    try {
      return fallbackPrefix + `${expression} = ${evaluateOfflineExpression(expression)}`
    } catch (error) {
      return fallbackPrefix + `这条计算没有完成：${error.message}。支持数字、括号以及 +、-、*、/、%、^。`
    }
  }

  if (/什么模式|当前模式|模型状态|运行状态|有没有联网|api|gpt|deepseek|ollama|离线/.test(lower)) {
    return fallbackPrefix + `BaiLONGMA v${getAppVersion()} 正在运行，当前后端是 ${OFFLINE_LITE_MODEL}。系统为 ${os.platform()} ${os.arch()}。此模式不调用 GPT／DeepSeek，也不需要安装 Ollama；连接任一完整模型后会获得开放式对话、复杂推理与自动工具规划。`
  }

  return fallbackPrefix + '我已收到你的消息，应用本身正在正常运行；但当前没有可用的完整大模型，所以这条开放式问题不能可靠作答。你仍可输入“帮助”、查询时间日期、做基础计算或查看运行状态。之后在设置中接入 GPT／DeepSeek 或本地 Ollama，即可恢复完整 AI 能力。'
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
