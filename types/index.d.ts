export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Snapshot = {
  contextTokens?: number
  contextPercent?: number
  contextWindow: number
  limits: Limit[]
  costUsd?: number
}

export type Tokens = { main: number; sub: number; calls: number }

// The first weekly reading this session, to measure the burn rate from.
export type Baseline = { percent: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-pulse': {
      snapshot: Shaped<Snapshot | null>
      tokens: Shaped<Tokens>
      baseline: Shaped<Baseline | null>
      autoCompact: Shaped<boolean>
    }
  }
}
