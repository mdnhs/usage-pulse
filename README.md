# usage-pulse

**See your Claude Code plan usage as you work, before you hit the limit.**

usage-pulse adds one calm line above the prompt:

```
Week 30% ↻5d 13h · 2.5%/h ⚠ out by Thursday · 5h 25% · Context 158k ⚠ · Session 623k · $3.45
```

## Why you might want it

On a Pro or Max plan, the weekly limit can run out days early without warning. When it does, the cause is usually something you couldn't see:

- **Subagents multiply usage.** Each subagent reloads the full system prompt and tool list, so a task that fans out to many agents can cost many times what a single conversation would.
- **Long sessions get expensive.** Every message resends the whole context. At 300k tokens of context, even a one-line question is a big request.
- **The expensive model runs unnoticed.** A session can stay on the largest model long after the hard part of the task is over.
- **Plugins and MCP servers add up.** Each one adds its tool definitions to every request, used or not.

Claude Code has `/usage` and `/cost`, but you have to remember to run them, and they show where you are, not where you're heading.

usage-pulse keeps those numbers in view all the time and adds what they don't show:

- **A forecast.** It measures how fast this session is using your weekly limit and tells you if you'll run out before the reset, while there is still time to change course.
- **A countdown.** You see when each limit resets, not just a date.
- **The session's real size.** Tokens across the main chat and every subagent, plus what the session would cost at API prices, so heavy sessions stand out.
- **A context warning.** A ⚠ appears when the context passes 150k tokens: a good moment to `/compact` or `/clear`.

The point isn't the numbers. It's noticing early: switching to a smaller model, clearing the context, or skipping a fan-out of subagents before the week's limit is gone.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-pulse --marketplace mdnhs/usage-pulse
```

Answer `y` to add the marketplace, then press Enter to pick the user scope, which installs it for every project. The bar appears after your next reply.

From a shell:

```
claude plugin install usage-pulse --marketplace mdnhs/usage-pulse
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins** → **Add marketplace** with `mdnhs/usage-pulse`, then **Add plugin**.

## Reading the bar

| Item | Example | Meaning |
| --- | --- | --- |
| Week | `Week 30% ↻5d 13h` | Share of your 7-day limit used, and time left until it resets |
| Forecast | `2.5%/h ⚠ out by Thursday` | How fast this session uses the weekly limit, and whether it runs out before the reset |
| 5h | `5h 25%` | Share of your 5-hour limit used. Its reset time appears once it passes 70% |
| Context | `Context 158k ⚠` | Tokens in the current context window. ⚠ appears above 150k |
| Session | `Session 623k · $3.45` | Tokens processed this session (main chat and subagents, cache reads included) and its cost at API prices |

The forecast has four states:

| State | Meaning |
| --- | --- |
| `Forecast: measuring` | The first 10 minutes of a session, before there is enough data |
| `Forecast: steady` | The weekly share hasn't moved |
| `0.8%/h · lasts to reset` | At this pace the limit outlasts the current week |
| `2.5%/h ⚠ out by Thursday` | At this pace the limit runs out before it resets |

**Colours.** Each item has its own soft colour that reads well on dark and light themes. A limit turns amber past 50% and coral past 80%, and you get a notification when the weekly limit passes 80%.

**Detail pane.** Run `/usage-pulse` to open a pane with a bar for each limit, the exact reset dates, the context window, and the session's tokens split between the main chat and subagents.

## Privacy and cost

Everything comes from Claude Code itself: the same rate-limit, context and cost figures behind the status line and `/cost`. usage-pulse:

- makes no network requests and no model calls, so it uses none of your limit;
- reads no files and stores nothing beyond the current session;
- shows limits only on a subscription (Pro or Max). With an API key the limit items are hidden, and the rest still shows.

The dollar figure is what the session would cost at API prices. On a subscription you are not billed for it, but it is a handy way to compare how heavy sessions are.

## Requirements

A Claude Code version that supports hooks-module plugins. Built and tested on Claude Code 2.1.310.

## Development

```
git clone https://github.com/mdnhs/usage-pulse.git
cd usage-pulse
claude --plugin-dir .
```

`--plugin-dir` loads the plugin from your working copy and reloads it when you save. The project is three files:

- `hooks/register.tsx`: the hooks module (the bar, the pane, the measurements)
- `types/index.d.ts`: the type contract for the values kept in session state
- `.claude-plugin/plugin.json`: the manifest

Before you open a pull request:

```
claude plugin validate .
npx tsc -p .
```

Claude Code writes its API types into `.claude-plugin/types/` the first time it loads the plugin, and `tsc` reads them from there.

## Contributing

Bug reports, ideas and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
