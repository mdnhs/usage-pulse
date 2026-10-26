# usage-pulse

[![License: MIT](https://img.shields.io/badge/license-MIT-8FBFA0.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-AFA3D6.svg)](https://github.com/mdnhs/usage-pulse)

**See your Claude Code plan usage as you work, before you hit the limit.**

usage-pulse is a Claude Code plugin that adds one calm line above the prompt. It shows how much of your weekly and 5-hour limits you have used, when they reset, which day you'll run out at your current pace, how large your context is, and what the session has cost. A switch beside the context size compacts the conversation for you once it grows too large.

```
Week 31% ↻5d 13h · 0.9%/h ⚠ Friday · 5h 30% · Context 158k ⚠ ━● · 7.5M · $8.32
```

## Contents

- [Why usage-pulse](#why-usage-pulse)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Reading the bar](#reading-the-bar)
  - [Forecast](#forecast)
  - [Auto-compact](#auto-compact)
  - [Detail pane](#detail-pane)
  - [Colours and alerts](#colours-and-alerts)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Uninstalling](#uninstalling)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Why usage-pulse

On a Pro or Max plan the weekly limit can run out days early, with no warning until it is gone. The cause is usually something that was hard to see while working:

| Cause | Why it costs so much |
| --- | --- |
| Subagents | Each subagent reloads the full system prompt and tool list, so a task that fans out to many agents costs many times what one conversation would. |
| Long sessions | Every message resends the whole context. At 300k tokens of context, even a one-line question is a large request. |
| The largest model | A session can stay on the most expensive model long after the hard part of the task is done. |
| Plugins and MCP servers | Each one adds its tool definitions to every request, whether they are used or not. |

Claude Code's `/usage` and `/cost` commands show where you stand, but only when you remember to run them, and neither tells you where you are heading. usage-pulse keeps the numbers in view and adds a forecast, so you can change course early: switch to a smaller model, clear the context, or skip a fan-out of subagents while there is still room in the week.

## Features

- **Live limit usage.** Weekly and 5-hour limits, updated after every reply.
- **Reset countdown.** Time left until each limit resets, such as `↻5d 13h`.
- **Forecast.** Your pace on the weekly limit, and the day it runs out if that comes before the reset.
- **Context size.** Tokens in the current context window, with a warning above 150k.
- **Session size and cost.** Tokens across the main chat and every subagent, and the session's cost at API prices.
- **Auto-compact switch.** One click to compact automatically whenever the context passes 150k tokens.
- **Detail pane.** A fuller view of every figure, one command away.
- **Free to run.** No network requests and no model calls, so it uses none of your limit.

## Installation

In a Claude Code terminal session, run:

```
/plugin install usage-pulse --marketplace mdnhs/usage-pulse
```

Answer `y` to add the marketplace, then press Enter to choose the user scope, which installs it for every project. The bar appears after your next reply.

<details>
<summary>Other ways to install</summary>

From a shell:

```
claude plugin install usage-pulse --marketplace mdnhs/usage-pulse
```

In the desktop app, where `/plugin` is not available: click **+** next to the prompt box, choose **Plugins** → **Add marketplace**, enter `mdnhs/usage-pulse`, then choose **Add plugin**.

</details>

## Usage

### Reading the bar

| Item | Example | Meaning |
| --- | --- | --- |
| Week | `Week 31% ↻5d 13h` | Share of your 7-day limit used, and the time left until it resets |
| Forecast | `0.9%/h ⚠ Friday` | Your pace on the weekly limit, and the day it runs out if that is before the reset |
| 5-hour | `5h 30%` | Share of your 5-hour limit used. Its reset time appears once it passes 70% |
| Context | `Context 158k ⚠` | Tokens in the current context window. ⚠ appears above 150k |
| Auto-compact | `●━` / `━●` | The auto-compact switch, off or on |
| Session | `7.5M · $8.32` | Tokens processed this session (main chat and subagents, cache reads included), and its cost at API prices |

### Forecast

The forecast works out two paces and uses the faster one:

- **This week's average.** The share used so far, divided by the hours since the week began, which is known from the reset time. It is available from the first reply.
- **This session's pace.** How far the share has moved since the session started, once it has run for 10 minutes. A heavy session can run well above the weekly average, so it still raises the warning.

| State | Meaning |
| --- | --- |
| `0.4%/h · lasts to reset` | At this pace the limit outlasts the current week |
| `0.9%/h ⚠ Friday` | At this pace the limit runs out on that day, before it resets |
| `Forecast: steady` | Nothing used yet this week |
| `Forecast: measuring` | Less than an hour into a new week, or no reset time reported yet |

### Auto-compact

The switch beside the context size turns auto-compact on and off: `●━` on a grey track is off, `━●` on a green track is on. It is off by default, and your choice is remembered across sessions and projects.

While it is on, usage-pulse runs `/compact` whenever the context passes 150k tokens:

1. within a few seconds of Claude finishing a reply, once the session is idle; or
2. if you send a message first, just before that message goes out.

A notification confirms each compaction. If one is skipped or fails, a notification says why.

**Why 150k.** Every message resends the whole context, so each question costs more as the context grows. Compacting replaces the conversation with a summary, and the messages after it cost far less.

### Detail pane

Run `/usage-pulse` to open a pane with:

- a bar for each limit, with its exact reset date and time;
- the context window, used against its size;
- the session's tokens, split between the main chat and subagents, and its cost at API prices.

### Colours and alerts

Each item has its own soft colour that reads well on dark and light themes. A limit turns amber past 50% and coral past 80%, and a notification appears when the weekly limit passes 80%.

## How it works

Every figure comes from Claude Code itself: the same rate-limit, context and cost data behind the status line and `/cost`. usage-pulse:

- makes no network requests and no model calls, so it costs nothing to run;
- reads no files;
- keeps one setting across sessions, whether auto-compact is on, in Claude Code's own plugin store.

Limits are shown only on a subscription (Pro or Max). With an API key, the limit items are hidden and the rest of the bar still works.

The dollar figure is what the session would cost at API prices. On a subscription you are not billed for it, but it is a useful way to compare how heavy sessions are.

## Requirements

- Claude Code with support for hooks-module plugins. Built and tested on Claude Code 2.1.310, in the VS Code extension.

## Uninstalling

```
claude plugin uninstall usage-pulse
```

To keep it installed but hide it for now, use `claude plugin disable usage-pulse` instead.

## Development

### Getting started

```
git clone https://github.com/mdnhs/usage-pulse.git
cd usage-pulse
claude --plugin-dir .
```

`--plugin-dir` loads the plugin from your working copy and reloads it when you save.

### Project structure

```
usage-pulse/
├── .claude-plugin/
│   ├── plugin.json        # plugin manifest
│   └── marketplace.json   # makes this repository installable as a marketplace
├── hooks/
│   ├── hooks.json         # points Claude Code at the hooks module
│   └── register.tsx       # the bar, the pane, the measurements and auto-compact
├── types/
│   └── index.d.ts         # type contract for the values kept in session state
├── tests/
│   └── auto-compact.test.tsx
└── tsconfig.json
```

### Checks

Run these before opening a pull request:

```
claude plugin validate .   # manifest and hooks module, as Claude Code reads them
claude plugin test .       # tests in tests/
npx tsc -p .               # type-check
```

Claude Code writes its API types into `.claude-plugin/types/` the first time it loads the plugin, and `tsc` reads them from there.

## Contributing

Bug reports, ideas and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before you start.

## License

Released under the [MIT License](LICENSE).
