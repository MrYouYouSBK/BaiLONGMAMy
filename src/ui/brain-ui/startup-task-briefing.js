// Shared by the backend startup publisher and the browser task briefing renderer.
const TERMINAL_STEP_STATES = new Set(['done', 'completed', 'skipped'])

function cleanText(value, maxLength = 280) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`
}

function validDateMs(value) {
  const milliseconds = Date.parse(String(value || ''))
  return Number.isFinite(milliseconds) ? milliseconds : null
}

export function buildStartupTaskBriefing({
  activeTask = '',
  taskSteps = [],
  reminders = [],
  now = new Date(),
  launchId = `launch-${Date.now().toString(36)}`,
  reminderLimit = 20,
} = {}) {
  const nowDate = now instanceof Date ? now : new Date(now)
  const nowMs = Number.isFinite(nowDate.getTime()) ? nowDate.getTime() : Date.now()
  const task = cleanText(activeTask)
  const openSteps = (Array.isArray(taskSteps) ? taskSteps : [])
    .filter(step => !TERMINAL_STEP_STATES.has(String(step?.status || 'pending').toLowerCase()))
    .map(step => ({
      text: cleanText(step?.text),
      status: String(step?.status || 'pending').toLowerCase(),
      note: cleanText(step?.note, 160),
    }))
    .filter(step => step.text)

  const normalizedReminders = (Array.isArray(reminders) ? reminders : [])
    .filter(reminder => reminder && (!reminder.status || reminder.status === 'pending'))
    .map(reminder => {
      const dueAt = String(reminder.due_at || reminder.dueAt || '')
      const dueMs = validDateMs(dueAt)
      return {
        id: Number(reminder.id) || null,
        task: cleanText(reminder.task),
        dueAt,
        recurrenceType: cleanText(reminder.recurrence_type || reminder.recurrenceType, 40) || null,
        overdue: dueMs !== null && dueMs <= nowMs,
      }
    })
    .filter(reminder => reminder.task)
    .sort((left, right) => {
      const leftMs = validDateMs(left.dueAt) ?? Number.MAX_SAFE_INTEGER
      const rightMs = validDateMs(right.dueAt) ?? Number.MAX_SAFE_INTEGER
      return leftMs - rightMs || (left.id || 0) - (right.id || 0)
    })

  const safeLimit = Math.max(1, Math.min(100, Number(reminderLimit) || 20))
  const visibleReminders = normalizedReminders.slice(0, safeLimit)
  const overdueCount = normalizedReminders.filter(reminder => reminder.overdue).length
  const totalItems = normalizedReminders.length + (task ? 1 : 0)

  return {
    launchId: cleanText(launchId, 120),
    generatedAt: new Date(nowMs).toISOString(),
    hasItems: totalItems > 0,
    totalItems,
    overdueCount,
    scheduledCount: normalizedReminders.length - overdueCount,
    hiddenReminderCount: normalizedReminders.length - visibleReminders.length,
    activeTask: task
      ? { task, openSteps, openStepCount: openSteps.length }
      : null,
    reminders: visibleReminders,
  }
}

function defaultFormatDate(value, language) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return String(value || '')
  try {
    return new Intl.DateTimeFormat(language === 'zh' ? 'zh-Hant' : 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch {
    return date.toLocaleString()
  }
}

export function formatStartupTaskBriefing(briefing = {}, {
  language = 'zh',
  formatDate = value => defaultFormatDate(value, language),
} = {}) {
  const isChinese = language === 'zh'
  const reminders = Array.isArray(briefing.reminders) ? briefing.reminders : []
  const activeTask = briefing.activeTask?.task ? briefing.activeTask : null
  const lines = [isChinese ? '**本次啟動任務提醒**' : '**Startup task briefing**']

  if (!briefing.hasItems) {
    lines.push('', isChinese
      ? '目前沒有待辦或逾期任務。'
      : 'There are no pending or overdue tasks.')
    return lines.join('\n')
  }

  if (activeTask) {
    lines.push('', isChinese
      ? `**進行中的任務：** ${activeTask.task}`
      : `**Active task:** ${activeTask.task}`)
    const openSteps = Array.isArray(activeTask.openSteps) ? activeTask.openSteps : []
    if (openSteps.length) {
      lines.push(isChinese ? '**尚未完成的步驟：**' : '**Open steps:**')
      for (const step of openSteps.slice(0, 10)) {
        const failed = step.status === 'failed'
        const prefix = failed ? '⚠️' : '•'
        const note = step.note ? ` — ${step.note}` : ''
        lines.push(`${prefix} ${step.text}${note}`)
      }
      if (openSteps.length > 10) {
        lines.push(isChinese
          ? `• 另有 ${openSteps.length - 10} 個未完成步驟`
          : `• ${openSteps.length - 10} more open step(s)`)
      }
    }
  }

  const reminderCount = reminders.length + Number(briefing.hiddenReminderCount || 0)
  if (reminderCount > 0) {
    lines.push('', isChinese
      ? `**待辦提醒：** ${reminderCount} 項，其中 ${Number(briefing.overdueCount || 0)} 項逾期`
      : `**Reminders:** ${reminderCount} pending, ${Number(briefing.overdueCount || 0)} overdue`)
    for (const reminder of reminders) {
      const dueLabel = reminder.overdue
        ? (isChinese ? '🔴 逾期' : '🔴 Overdue')
        : (isChinese ? '🗓️ 到期' : '🗓️ Due')
      let dueAt = reminder.dueAt
      try { dueAt = formatDate(reminder.dueAt) || reminder.dueAt } catch {}
      const repeat = reminder.recurrenceType
        ? (isChinese ? ` · 重複：${reminder.recurrenceType}` : ` · repeats: ${reminder.recurrenceType}`)
        : ''
      lines.push(`- ${dueLabel} ${dueAt}${repeat} — ${reminder.task}`)
    }
    if (Number(briefing.hiddenReminderCount || 0) > 0) {
      lines.push(isChinese
        ? `- 另有 ${briefing.hiddenReminderCount} 項，請在 GAI Control Center 查看`
        : `- ${briefing.hiddenReminderCount} more; open GAI Control Center to review`)
    }
  }

  lines.push('', isChinese
    ? 'GAI AI 會在到期時間自動提醒並跟進。'
    : 'GAI AI will remind you and follow up automatically when each item is due.')
  return lines.join('\n')
}

export function formatStartupTaskNotification(briefing = {}) {
  const total = Number(briefing.totalItems || 0)
  const overdue = Number(briefing.overdueCount || 0)
  if (total <= 0) return ''
  return `${total} pending · ${overdue} overdue / ${total} 項待辦 · ${overdue} 項逾期`
}
