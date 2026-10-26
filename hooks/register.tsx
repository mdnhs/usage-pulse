import { atom, read, update } from 'claude-code'
import type {
  EngineInterface,
  Register,
  SessionCost,
  SessionContextUsage,
  SessionRateLimit,
} from 'claude-code'

import type { Limit, Snapshot, Tokens } from '../types'

const PANE = 'usage-pulse'
const TITLE = 'Usage'
// Change the tag when Snapshot's or Tokens' fields change.
const snapshot = atom({ plugin: 'usage-pulse', key: 'snapshot' } as const, null, {
  shape: 'snapshot-2',
})
const tokens = atom(
  { plugin: 'usage-pulse', key: 'tokens' } as const,
  { main: 0, sub: 0, calls: 0 },
  { shape: 'tokens-1' },
)

const baseline = atom({ plugin: 'usage-pulse', key: 'baseline' } as const, null, {
  shape: 'baseline-1',
})
// Mirrors the 'autoCompact' store key, which keeps the toggle across sessions.
const autoCompact = atom({ plugin: 'usage-pulse', key: 'autoCompact' } as const, false, {
  shape: 'auto-compact-1',
})

// Context size that raises the ⚠ and, with the toggle on, compacts.
const LARGE_CONTEXT = 150_000

const HOUR = 3_600_000
const WEEK = 7 * 24 * HOUR
// Wait this long before trusting a burn rate: a session's, and a fresh week's.
const MIN_RATE_WINDOW = 10 * 60_000
const MIN_WEEK_ELAPSED = HOUR
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// The two largest units: "5d 13h", "3h 20m", "29m".
const shortTime = (ms: number) => {
  if (ms <= 0) return 'now'
  const days = Math.floor(ms / (24 * HOUR))
  const hours = Math.floor((ms % (24 * HOUR)) / HOUR)
  const minutes = Math.floor((ms % HOUR) / 60_000)
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  return `${Math.max(1, minutes)}m`
}

// Soft mid-tones that read on dark and light themes alike.
const SOFT = {
  sage: '#8FBFA0',
  sky: '#86B4D4',
  lavender: '#AFA3D6',
  sand: '#C2B49A',
  amber: '#D9B26F',
  coral: '#D98E80',
}

// Each item keeps its own calm colour until it matters, then amber, then coral.
const quietColor = (percent: number, base: string) =>
  percent >= 80 ? SOFT.coral : percent >= 50 ? SOFT.amber : base

const resetIn = (limit: Limit, now: number) => {
  const at = limit.resetsAt ? Date.parse(limit.resetsAt) : NaN
  return Number.isNaN(at) ? undefined : at - now
}

const fmtTokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n)

const fmtUsd = (usd?: number) => (usd === undefined ? '—' : `$${usd.toFixed(2)}`)

const LABELS: Record<string, string> = {
  seven_day: 'Weekly limit',
  five_hour: '5-hour limit',
  spend_limit: 'Spend limit',
}

const toSnapshot = (
  context: SessionContextUsage,
  limits: SessionRateLimit[],
  cost?: SessionCost,
): Snapshot => ({
  contextTokens: context.tokens,
  contextPercent: context.percent,
  contextWindow: context.window,
  limits: limits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
  costUsd: cost?.usd,
})

const bar = (percent: number) => {
  const filled = Math.round(Math.min(100, Math.max(0, percent)) / 5)
  return '█'.repeat(filled) + '░'.repeat(20 - filled)
}

const resetText = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `Resets ${day}, ${time}`
}

let isCompacting = false

// Compacts between turns; a call made while a turn runs is refused, and the
// next prompt tries again.
async function compactNow($: EngineInterface) {
  if (isCompacting) return
  isCompacting = true
  try {
    const result = await $.session.compact()
    if ('skip' in result) return
    const usage = await $.session.usage()
    await update($, snapshot, () => toSnapshot(usage.context, usage.rateLimits, usage.cost))
    $.ui.toast('Auto-compacted: context was over 150k tokens')
  } catch {
    // A turn was running; prompt.submit retries.
  } finally {
    isCompacting = false
  }
}

async function toggleAutoCompact($: EngineInterface) {
  const isOn = !(await read($, autoCompact))
  await update($, autoCompact, () => isOn)
  await $.store.set('autoCompact', isOn)
  $.ui.toast(isOn ? 'Auto-compact on: compacts when context passes 150k' : 'Auto-compact off')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'usage-pulse',
      description: 'Open the usage pane (weekly limit, 5-hour limit, context, session cost)',
    })
    const result = await next(e)
    const usage = await $.session.usage()
    await update($, snapshot, () => toSnapshot(usage.context, usage.rateLimits, usage.cost))
    const isOn = (await $.store.get('autoCompact')) === true
    await update($, autoCompact, () => isOn)

    return result
  })

  on('prompt.submit', async ($, e, next) => {
    const snap = await read($, snapshot)
    if ((await read($, autoCompact)) && (snap?.contextTokens ?? 0) >= LARGE_CONTEXT) {
      await compactNow($)
    }

    return next(e)
  })

  on('command.run', { command: 'usage-pulse' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Usage pane opened.' }
  })

  on('session.measure', async ($, e, next) => {
    await update($, snapshot, () => toSnapshot(e.context, e.rateLimits, e.cost))

    const weekly = e.rateLimits.find(l => l.kind === 'seven_day')
    if (weekly) {
      const now = await $.clock.now()
      // Start over on the first reading, and when the window resets under us.
      await update($, baseline, b =>
        b === null || weekly.percentUsed < b.percent ? { percent: weekly.percentUsed, at: now } : b,
      )
    }
    if (weekly && e.changed.includes('rateLimits') && weekly.percentUsed >= 80) {
      $.ui.toast(`${weekly.percentUsed}% of your weekly limit is used`)
    }
    if ((await read($, autoCompact)) && (e.context.tokens ?? 0) >= LARGE_CONTEXT) {
      // Measured as a turn ends: give it a moment to settle, then compact.
      $.clock.after(1500, () => void compactNow($))
    }

    return next(e)
  })

  // Every model request, the main thread's and each subagent's.
  on('turn.step', async function* ($, e, next) {
    const response = yield* next(e)
    const u = response?.usage
    if (u) {
      const total =
        u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
      await update($, tokens, t =>
        e.agentId === undefined
          ? { ...t, main: t.main + total, calls: t.calls + 1 }
          : { ...t, sub: t.sub + total, calls: t.calls + 1 },
      )
    }

    return response
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    const tok = await read($, tokens)
    if (e.props.hasSurvey || !snap) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const base = await read($, baseline)
    const weekly = snap.limits.find(l => l.kind === 'seven_day')
    const fiveHour = snap.limits.find(l => l.kind === 'five_hour')
    const ctxK = snap.contextTokens === undefined ? undefined : Math.round(snap.contextTokens / 1000)
    const weeklyReset = weekly && resetIn(weekly, now)
    const fiveHourReset = fiveHour && resetIn(fiveHour, now)

    // Two paces for the weekly limit: the average since the week began (known
    // from the reset time), and this session's since its first reading. The
    // faster one decides where it lands, so a heavy session still warns.
    let weekPace: number | undefined
    if (weekly && weeklyReset !== undefined) {
      const elapsed = WEEK - weeklyReset
      if (elapsed >= MIN_WEEK_ELAPSED) weekPace = weekly.percentUsed / (elapsed / HOUR)
    }
    let sessionPace: number | undefined
    if (weekly && base && now - base.at >= MIN_RATE_WINDOW) {
      sessionPace = (weekly.percentUsed - base.percent) / ((now - base.at) / HOUR)
    }
    const paces = [weekPace, sessionPace].filter((p): p is number => p !== undefined)

    let burn: { perHour: number; emptyAt?: number } | undefined
    if (weekly && paces.length > 0) {
      const perHour = Math.max(...paces)
      if (perHour > 0) {
        const emptyAt = now + ((100 - weekly.percentUsed) / perHour) * HOUR
        const beforeReset = weeklyReset === undefined || emptyAt < now + weeklyReset
        burn = { perHour, emptyAt: beforeReset ? emptyAt : undefined }
      }
    }

    // One calm line, each item in its own soft colour.
    const parts: { text: string; color: string }[] = []
    if (weekly) {
      const reset = weeklyReset !== undefined ? ` ↻${shortTime(weeklyReset)}` : ''
      parts.push({
        text: `Week ${weekly.percentUsed}%${reset}`,
        color: quietColor(weekly.percentUsed, SOFT.sage),
      })

      if (burn?.emptyAt) {
        const day = WEEKDAYS[new Date(burn.emptyAt).getDay()]
        parts.push({ text: `${burn.perHour.toFixed(1)}%/h ⚠ out by ${day}`, color: SOFT.amber })
      } else if (burn) {
        parts.push({ text: `${burn.perHour.toFixed(1)}%/h · lasts to reset`, color: SOFT.sage })
      } else {
        parts.push({
          text: paces.length > 0 ? 'Forecast: steady' : 'Forecast: measuring',
          color: 'subtle',
        })
      }
    }
    if (fiveHour) {
      // The 5-hour reset only matters once it is close to the cap.
      const reset =
        fiveHour.percentUsed >= 70 && fiveHourReset !== undefined ? ` ↻${shortTime(fiveHourReset)}` : ''
      parts.push({
        text: `5h ${fiveHour.percentUsed}%${reset}`,
        color: quietColor(fiveHour.percentUsed, SOFT.sky),
      })
    }
    if (ctxK !== undefined) {
      parts.push({
        text: ctxK * 1000 >= LARGE_CONTEXT ? `Context ${ctxK}k ⚠` : `Context ${ctxK}k`,
        color: ctxK * 1000 >= LARGE_CONTEXT ? SOFT.amber : SOFT.lavender,
      })
    }
    if (snap.costUsd !== undefined) {
      const used = tok.calls > 0 ? `${fmtTokens(tok.main + tok.sub)} · ` : ''
      parts.push({ text: `Session ${used}${fmtUsd(snap.costUsd)}`, color: SOFT.sand })
    }

    if (parts.length === 0) {
      return <Text dimColor>Usage shows after the first reply</Text>
    }

    const isAutoCompact = await read($, autoCompact)

    // Space between items only: a gap would also open between wrapped rows.
    return (
      <Box flexWrap="wrap" columnGap={1} rowGap={0}>
        {parts.flatMap((p, i) => [
          ...(i > 0 ? [<Text dimColor>·</Text>] : []),
          <Text color={p.color}>{p.text}</Text>,
        ])}
        <Text dimColor>·</Text>
        <Button
          key="auto-compact"
          label={isAutoCompact ? 'Auto-compact: on' : 'Auto-compact: off'}
          plain
          dimColor={!isAutoCompact}
          onPress={() => toggleAutoCompact($)}
        />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const snap = await read($, snapshot)
    const tok = await read($, tokens)

    if (!snap) {
      return <Text dimColor>Usage shows after the first reply.</Text>
    }

    const order = ['seven_day', 'five_hour', 'spend_limit']
    const limits = [...snap.limits].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    const ctxK = snap.contextTokens === undefined ? undefined : Math.round(snap.contextTokens / 1000)
    const ctxPercent = snap.contextPercent ?? 0

    return (
      <Box flexDirection="column" gap={1}>
        {limits.length === 0 && (
          <Text dimColor>No limit reading yet (send a message to get one).</Text>
        )}
        {limits.map(l => (
          <Box flexDirection="column">
            <Text bold>
              {LABELS[l.kind] ?? l.kind}: {l.percentUsed}%
            </Text>
            <Text color={quietColor(l.percentUsed, SOFT.sage)} mono>
              {bar(l.percentUsed)}
            </Text>
            <Text dimColor>{resetText(l.resetsAt)}</Text>
          </Box>
        ))}
        <Box flexDirection="column">
          <Text bold>
            Context: {ctxK === undefined ? '—' : `${ctxK}k`} / {Math.round(snap.contextWindow / 1000)}k
          </Text>
          <Text color={quietColor(ctxPercent, SOFT.lavender)} mono>
            {bar(ctxPercent)}
          </Text>
          {(ctxK ?? 0) >= 150 && (
            <Text color={SOFT.amber}>Context is large: run /compact or /clear</Text>
          )}
        </Box>
        <Box flexDirection="column">
          <Text bold>
            This session: {fmtTokens(tok.main + tok.sub)} tokens, {tok.calls} calls
          </Text>
          <Text dimColor>
            Main chat {fmtTokens(tok.main)} · Subagents {fmtTokens(tok.sub)}
          </Text>
          <Text dimColor>
            At API prices: {fmtUsd(snap.costUsd)} (not billed separately on a subscription)
          </Text>
        </Box>
      </Box>
    )
  })
}
