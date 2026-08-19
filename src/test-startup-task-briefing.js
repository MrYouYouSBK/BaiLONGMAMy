import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildStartupTaskBriefing,
  formatStartupTaskBriefing,
  formatStartupTaskNotification,
} from './ui/brain-ui/startup-task-briefing.js'

const now = new Date('2026-08-19T10:00:00.000Z')

const empty = buildStartupTaskBriefing({ now, launchId: 'empty-launch' })
assert.equal(empty.launchId, 'empty-launch')
assert.equal(empty.hasItems, false)
assert.equal(empty.totalItems, 0)
assert.match(formatStartupTaskBriefing(empty, { language: 'zh' }), /沒有待辦或逾期任務/)
assert.equal(formatStartupTaskNotification(empty), '')

const briefing = buildStartupTaskBriefing({
  now,
  launchId: 'test-launch',
  activeTask: 'Prepare trusted macOS release',
  taskSteps: [
    { text: 'Create release build', status: 'done' },
    { text: 'Add Apple credentials', status: 'pending' },
    { text: 'Retry notarization', status: 'failed', note: 'Credentials missing' },
    { text: 'Optional cleanup', status: 'skipped' },
  ],
  reminders: [
    { id: 2, task: 'Future follow-up', due_at: '2026-08-20T09:00:00.000Z', status: 'pending' },
    { id: 1, task: 'Overdue follow-up', due_at: '2026-08-19T09:00:00.000Z', status: 'pending', recurrence_type: 'daily' },
    { id: 3, task: 'Ignore fired task', due_at: '2026-08-18T09:00:00.000Z', status: 'fired' },
  ],
})

assert.equal(briefing.hasItems, true)
assert.equal(briefing.totalItems, 3)
assert.equal(briefing.overdueCount, 1)
assert.equal(briefing.scheduledCount, 1)
assert.deepEqual(briefing.activeTask.openSteps.map(step => step.status), ['pending', 'failed'])
assert.deepEqual(briefing.reminders.map(reminder => reminder.id), [1, 2])

const zh = formatStartupTaskBriefing(briefing, {
  language: 'zh',
  formatDate: value => `DATE(${value})`,
})
assert.match(zh, /Prepare trusted macOS release/)
assert.match(zh, /尚未完成的步驟/)
assert.match(zh, /1 項逾期/)
assert.match(zh, /DATE\(2026-08-19T09:00:00.000Z\)/)
assert.match(zh, /重複：daily/)

const en = formatStartupTaskBriefing(briefing, {
  language: 'en',
  formatDate: value => `DATE(${value})`,
})
assert.match(en, /Startup task briefing/)
assert.match(en, /1 overdue/)
assert.match(en, /repeats: daily/)
assert.equal(formatStartupTaskNotification(briefing), '3 pending · 1 overdue / 3 項待辦 · 1 項逾期')

const runtimeSource = readFileSync(new URL('./index.js', import.meta.url), 'utf8')
const uiSource = readFileSync(new URL('./ui/brain-ui/app.js', import.meta.url), 'utf8')
assert.match(runtimeSource, /setStickyEvent\('startup_task_briefing', briefing\)/)
assert.match(runtimeSource, /publishStartupTaskBriefing\(\)/)
assert.match(uiSource, /case "startup_task_briefing"/)
assert.match(uiSource, /chat\.restoreChatHistory\(\)\.finally\(connectSSE\)/)

console.log('startup task briefing tests passed')
