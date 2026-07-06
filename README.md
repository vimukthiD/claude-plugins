# claude-plugins

Personal Claude Code plugin marketplace for vimukthiD. Public repo, closed contribution model:

- No external plugins accepted, no outside PRs merged. Everything here is either something I wrote myself, or a full vendored copy of a plugin I vetted elsewhere.
- "Vendored" means the plugin's files are committed to this repo, copied from a specific reviewed upstream commit (recorded in the table below). Nothing here changes until I've diffed upstream and copied the update in myself.

## Quick start

```bash
/plugin marketplace add vimukthiD/claude-plugins
/plugin install feature-dev@vimukthi-plugins
/plugin install wikijs@vimukthi-plugins
```

The same commands work from a shell as `claude plugin marketplace add …` / `claude plugin install …` (add `--scope project` to enable a plugin only in the current project).

### Invoking plugin commands

Plugin slash commands are always namespaced as `/<plugin-name>:<command-name>` — bare command names don't resolve (by design; [anthropics/claude-code#15882](https://github.com/anthropics/claude-code/issues/15882), closed as not-planned). So feature-dev's workflow command is:

```
/feature-dev:feature-dev Add user authentication with OAuth
```

The name doubles because the plugin and its one command share the name `feature-dev`. Upstream's own README shows bare `/feature-dev …`, which predates mandatory namespacing — typing `/fea` and picking the autocomplete entry does the right thing.

## What's in here

| Plugin | Install | Source | Notes |
|---|---|---|---|
| `feature-dev` | `/plugin install feature-dev@vimukthi-plugins` | Vendored from `anthropics/claude-plugins-official` at `26db21ae` | 7-phase feature-dev workflow. Vetted 2026-07-05: first-party Anthropic plugin, no hooks, no MCP server, subagents capped to read/web-only tools (no Bash/Write/Edit). |
| `wikijs` | `/plugin install wikijs@vimukthi-plugins` | My own code, lives in this repo | MCP server for a self-hosted Wiki.js instance (8 page-management tools over GraphQL). Credentials are read from `~/.wikijs-mcp/config.json` or env vars on the local machine — never committed here. See [its README](plugins/wikijs/README.md). |
| `playwright` | `claude plugin install playwright@vimukthi-plugins --scope project` | Wrapper around Microsoft's `@playwright/mcp`, pinned to `0.0.77` | Browser automation via headless isolated Chromium; meant for per-project activation. `npx`-fetched at first spawn (pinned, but no committed lockfile — see [its README](plugins/playwright/README.md)). |

## Updating a vendored plugin

1. Diff the vendored commit (recorded in the table above) against upstream's latest, e.g.:
   `https://github.com/anthropics/claude-plugins-official/compare/<old-sha>...<new-sha>`
2. Re-review, specifically: any new `hooks/` folder, any new or changed `.mcp.json`, any change to a `tools:` line in an agent's frontmatter, anything that reads like an embedded instruction aimed at the model.
3. Copy the updated upstream files over `plugins/<name>/` (delete removed files too — the copy should mirror upstream exactly).
4. Update the sha in the table above and commit with a note on what was reviewed and what changed.

## Adding my own plugin

Drop it under `plugins/<name>/` with its own `.claude-plugin/plugin.json`, then add an entry to `marketplace.json` with `"source": "./plugins/<name>"`.

## License & attribution

This repo is licensed under the [Apache License 2.0](LICENSE).

`plugins/feature-dev/` is not my work: it is [Anthropic's feature-dev plugin](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/feature-dev), vendored **unmodified** from [`anthropics/claude-plugins-official`](https://github.com/anthropics/claude-plugins-official) at commit [`26db21ae`](https://github.com/anthropics/claude-plugins-official/tree/26db21ae4fa1748aaa74fc4c01d340aaac92f4f1/plugins/feature-dev). It is Copyright Anthropic, PBC, under Apache-2.0 — its original license is retained at [`plugins/feature-dev/LICENSE`](plugins/feature-dev/LICENSE), and full credit belongs to its original authors. See [NOTICE](NOTICE).

## Why this exists

Full reasoning and setup history — including why plugins are pinned instead of vendored, why this is public with no collaborators, and the local machine lockdown that makes this the *only* marketplace this account will install from — lives in a local `HANDOFF.md` kept alongside this repo, not committed here.
