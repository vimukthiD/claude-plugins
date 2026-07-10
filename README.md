# claude-plugins

Personal Claude Code plugin marketplace for vimukthiD. Public repo, closed contribution model:

- No external plugins accepted, no outside PRs merged. Everything here is either something I wrote myself, or a full vendored copy of a plugin I vetted elsewhere.
- "Vendored" means the plugin's files are committed to this repo, copied from a specific reviewed upstream commit (recorded in the table below). Nothing here changes until I've diffed upstream and copied the update in myself.

## Quick start

> **First time on this machine?** These commands assume the marketplace lockdown is already deployed — do [Setting up on a new machine](#setting-up-on-a-new-machine) first.

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

## Setting up on a new machine

The install commands above assume the marketplace lockdown is already in place. On a fresh machine, deploy it first — this is what makes `vimukthi-plugins` the *only* marketplace this account will install plugins, skills, agents, hooks, or MCP servers from (see [Why this exists](#why-this-exists)). It's a local settings file, not a cryptographic guarantee: anything with admin rights on the machine can edit it back open. What it removes is the one-command impulse install.

### 1. Check the Claude Code version

```bash
claude --version
```

The `strictPluginOnlyCustomization` key below is only honored on **v2.1.82 or later**. Everything else works on older versions, but that key is silently ignored — upgrade before relying on it.

### 2. Deploy the managed-settings lockdown

Claude Code reads a system-level `managed-settings.json` that project and user settings cannot override. Create a file with exactly this content:

```json
{
  "strictKnownMarketplaces": [
    { "source": "github", "repo": "vimukthiD/claude-plugins" }
  ],
  "extraKnownMarketplaces": {
    "vimukthi-plugins": {
      "source": { "source": "github", "repo": "vimukthiD/claude-plugins" }
    }
  },
  "strictPluginOnlyCustomization": false
}
```

- **`strictKnownMarketplaces`** — the allowlist of marketplaces Claude Code will accept, checked before any network or filesystem access. Set to just this repo, so every other `/plugin marketplace add` is rejected. Can't be overridden by project or user settings.
- **`extraKnownMarketplaces`** — pre-registers this repo under the name `vimukthi-plugins`, so it's known automatically without a manual `add`.
- **`strictPluginOnlyCustomization`** — left **`false` on purpose**. Setting it `true` blocks skills/agents/hooks/MCP servers from loading out of any `~/.claude/` or project `.claude/` folder outside the plugin system — but other projects on this machine keep folder-level `.claude/` customizations deliberately, so it stays off here. Flip it to `true` only on a machine where you want *everything* forced through the marketplace.

Write that JSON to the OS-specific path:

| OS | Path |
|---|---|
| macOS | `/Library/Application Support/ClaudeCode/managed-settings.json` |
| Linux / WSL | `/etc/claude-code/managed-settings.json` |
| Windows | `C:\Program Files\ClaudeCode\managed-settings.json` |

On macOS/Linux this needs `sudo`, and the deployed file **must stay world-readable (`644`)**:

```bash
sudo cp managed-settings.json "/Library/Application Support/ClaudeCode/managed-settings.json"
sudo chmod 644 "/Library/Application Support/ClaudeCode/managed-settings.json"
```

At `600` Claude Code can't read the file and the lockdown **silently deactivates** — no error, it just stops enforcing. Restart Claude Code after deploying so it re-reads the file.

### 3. Verify the lockdown

```
/plugin marketplace add anthropics/claude-plugins-official   # expect: rejected
/plugin install feature-dev@vimukthi-plugins                 # expect: works
```

A disallowed marketplace add should be refused; `vimukthi-plugins` should already be known (from `extraKnownMarketplaces`) and installable. If the disallowed add *succeeds*, the settings file isn't being read — re-check its path and that it's `644`.

### 4. Per-plugin local config

Some plugins need machine-local config that is deliberately never committed here:

- **feature-dev** — none. Install and go.
- **wikijs** — needs a Wiki.js endpoint and API key, read from `~/.wikijs-mcp/config.json` (`chmod 600`) or the `WIKIJS_URL` / `WIKIJS_API_KEY` env vars. The key comes from Wiki.js **Administration → API Access**. Config format and precedence in [its README](plugins/wikijs/README.md).
- **playwright** — install per project (`claude plugin install playwright@vimukthi-plugins --scope project`), fetch the browser binary once per machine (`npx -y @playwright/mcp@0.0.77 install-browser chrome-for-testing`), and add a `browser_run_code_unsafe` **deny** rule to each project that enables it. Details in [its README](plugins/playwright/README.md).

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

The mechanical setup is in [Setting up on a new machine](#setting-up-on-a-new-machine) above. The full *reasoning* — why plugins are pinned instead of vendored, why this is public with no collaborators, why the lockdown makes this the *only* marketplace this account will install from — lives in a local `HANDOFF.md` kept alongside this repo, not committed here.
