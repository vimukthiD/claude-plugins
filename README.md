# claude-plugins

Personal Claude Code plugin marketplace for vimukthiD. Public repo, closed contribution model:

- No external plugins accepted, no outside PRs merged. Everything here is either something I wrote myself, or a pinned reference to a plugin I vetted elsewhere.
- "Pinned" means every external entry in `marketplace.json` locks to an exact upstream commit `sha`. Nothing here changes until I've reviewed a diff and bumped that sha myself.

## Quick start

```bash
/plugin marketplace add vimukthiD/claude-plugins
/plugin install feature-dev@vimukthi-plugins
```

## What's in here

| Plugin | Source | Notes |
|---|---|---|
| `feature-dev` | Pinned copy of `anthropics/claude-plugins-official` | 7-phase feature-dev workflow. Vetted 2026-07-05: first-party Anthropic plugin, no hooks, no MCP server, subagents capped to read/web-only tools (no Bash/Write/Edit). |

## Updating a pinned plugin

1. Diff the current `sha` in `.claude-plugin/marketplace.json` against upstream's latest commit, e.g.:
   `https://github.com/anthropics/claude-plugins-official/compare/<old-sha>...<new-sha>`
2. Re-review, specifically: any new `hooks/` folder, any new or changed `.mcp.json`, any change to a `tools:` line in an agent's frontmatter, anything that reads like an embedded instruction aimed at the model.
3. Bump the `sha` field.
4. Commit with a note on what was reviewed and what changed.

## Adding my own plugin

Drop it under `plugins/<name>/` with its own `.claude-plugin/plugin.json`, then add an entry to `marketplace.json` with `"source": "./plugins/<name>"`.

## Why this exists

Full reasoning and setup history — including why plugins are pinned instead of vendored, why this is public with no collaborators, and the local machine lockdown that makes this the *only* marketplace this account will install from — lives in a local `HANDOFF.md` kept alongside this repo, not committed here.
