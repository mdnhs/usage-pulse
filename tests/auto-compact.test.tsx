import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-pulse',
  component: 'AbovePrompt',
  props: { hasSurvey: false },
} as const

const measure = (tokens: number) => ({
  context: { tokens, window: 200_000, percent: Math.round(tokens / 2000) },
  rateLimits: [{ kind: 'seven_day', percentUsed: 30 }],
  changed: ['context', 'rateLimits'] as ('context' | 'rateLimits')[],
})

// Stands in for the engine: commands, usage, the store, compaction.
const engine = (on: Parameters<Parameters<typeof test>[1]>[1], log: string[], stored: { value?: unknown }) => {
  on('clock.now', () => ({ value: Date.parse('2026-10-27T12:00:00Z') }))
  on('clock.after', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'usage-pulse' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, ...measure(160_000), changed: undefined } }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('store.get', () => ({ value: stored.value }))
  on('store.set', (_, e) => {
    stored.value = e.value
    log.push(`store.set ${String(e.value)}`)
    return { value: undefined }
  })
  on('session.compact', () => {
    log.push('compact')
    return { messages: [{ role: 'user', text: 'Summary of the conversation so far.', toolUses: [] }] }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
}

test('the toggle starts off and turns on, remembered in the store', async ($, on) => {
  const log: string[] = []
  engine(on, log, {})
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  await $.session.measure(measure(40_000))

  const ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
  expect((await ui.find({ key: 'auto-compact' }))?.text).toBe('Auto-compact: off')

  await ui.press({ key: 'auto-compact' })
  expect(log).toContain('store.set true')
  expect((await ui.find({ key: 'auto-compact' }))?.text).toBe('Auto-compact: on')
  await ui.unmount()
})

test('with the toggle on, a prompt over 150k compacts first', async ($, on) => {
  const log: string[] = []
  engine(on, log, { value: true })
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  await $.session.measure(measure(160_000))

  await $.prompt.submit({ text: 'next question' })
  expect(log).toContain('compact')
})

test('with the toggle off, nothing compacts', async ($, on) => {
  const log: string[] = []
  engine(on, log, { value: false })
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  await $.session.measure(measure(160_000))

  await $.prompt.submit({ text: 'next question' })
  expect(log).not.toContain('compact')
})
