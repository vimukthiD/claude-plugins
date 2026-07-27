# claude-plugins

Personal Claude Code plugin marketplace (`vimukthi-plugins`). This machine's managed settings allowlist exactly this marketplace — it is the only permitted plugin source here. Everything committed is vetted first; treat every change as a release.

## Layout

- `.claude-plugin/marketplace.json` — the marketplace manifest. Must live at exactly this path or `/plugin marketplace add` fails.
- `plugins/feature-dev/` — vendored **byte-identical** from `anthropics/claude-plugins-official` (vetted sha in the README table). Never hand-edit these files; updating means diff upstream, re-review, copy over exactly, update the sha in the README.
- `plugins/wikijs/` — first-party MCP server. `src/` is the source of truth; `server/index.cjs` is the esbuild bundle that actually runs (self-contained, no runtime node_modules).
- `plugins/dev-kit/` — first-party agents and commands only: no hooks, no MCP server, nothing machine-local. Four agents (`architect`, `builder`, `operator`, `scout`) each pinned to an exact model ID and an explicit `effort`; `/dev-kit:delegate` is the deterministic routing path when automatic agent selection can't be trusted.
- `plugins/playwright/` — thin wrapper pinning Microsoft's `@playwright/mcp` at an exact version via npx. No code of ours beyond config.
- `HANDOFF.md` and `managed-settings.template.json` — **gitignored, local machine files**. The template mirrors the deployed managed-settings file (macOS: `/Library/Application Support/ClaudeCode/managed-settings.json`); deploy with `sudo cp`, and the deployed file must stay world-readable (644) — at 600 Claude Code can't read it and the lockdown silently deactivates.

## Release rules

- **Every plugin content change bumps `version`** in that plugin's `.claude-plugin/plugin.json`, same commit. Installed copies only refresh on a manifest version change — an unbumped change never reaches existing installs.
- Rollout after push: `claude plugin marketplace update vimukthi-plugins`, then `claude plugin update <name>@vimukthi-plugins`. Project-scoped installs need `--scope project` and must run from that project's directory — scope is not auto-detected.
- No secrets, tokens, or internal hostnames in this repo, ever. Machine-local config lives outside the repo (e.g. wikijs credentials in `~/.wikijs-mcp/config.json`, mode 600).
- wikijs rebuild: `npm ci --ignore-scripts && npm run bundle` inside `plugins/wikijs/` — never plain `npm install`, never unpinned `npx` build tools. All deps are exact-pinned with a lockfile. Verify the new bundle over real stdio (initialize → tools/list → one live tool call) before committing, and commit `src/` + `server/index.cjs` together.
- Dependency pins (wikijs `package.json`, playwright's `@playwright/mcp@X.Y.Z`) move only deliberately: review upstream changes, bump, re-verify, record what was reviewed in the commit message.
- dev-kit agents pin **exact model IDs** (`claude-fable-5`, `claude-opus-5`, …), never aliases like `model: opus`. An alias can silently re-point to a different model at a different price; an exact ID fails loudly when that ID is withdrawn, and that noisy failure is the point. `effort:` is pinned for the same reason. One bounded exception: `/dev-kit:delegate` may pass the tier alias `model: "sonnet"` as a **per-call Agent override** on builder calls for mechanical work — the Agent tool accepts only aliases for overrides, and the frontmatter pins are untouched. Do not "fix" that alias to an exact ID (it would fail), and do not extend the exception to other agents. Re-tiering an agent means editing its `model:`/`effort:` line and bumping `version` in the same commit — and keeping the plugin README's agent table and the `plugin.json` description in step with it.

## Gotchas learned the hard way

- Plugin slash commands are always namespaced `/<plugin>:<command>` — hence `/feature-dev:feature-dev`. Bare names don't resolve (upstream docs claiming otherwise are outdated; anthropics/claude-code#15882).
- Plugin MCP tools are named `mcp__plugin_<plugin>_<server>__<tool>`; permission deny rules with these names remove the tool from sessions entirely (an `--allowedTools` grant cannot override a deny).
- Plugin-spawned MCP servers run with the project directory as cwd, so relative paths in server args (like playwright's `--output-dir`) resolve project-locally.
- `strictPluginOnlyCustomization` stays `false` **by design** — other projects on this machine keep folder-level `.claude/` customizations deliberately. Don't "fix" it to true.
- Plugin agents **silently ignore `permissionMode`**. The `tools:` list is the only real permission boundary — that's why dev-kit's `architect` is read-only by tool grant (`Read, Grep, Glob`) rather than by mode.
- A subagent with no `effort:` in frontmatter **inherits the session's level** — in an `xhigh` session the built-in `Explore`/`Plan`/`general-purpose` agents were all running at `xhigh`, i.e. maximum-depth reasoning to run a grep. `model:` sets the per-token rate, `effort:` sets how many thinking tokens get generated and billed; pin both or a cheap model still thinks expensively. Precedence, highest first: `CLAUDE_CODE_EFFORT_LEVEL` env var → agent frontmatter → session level (`/effort`, `--effort`, `effortLevel`) → model default. If that env var is set on this machine it silently overrides every pin in dev-kit — check it before concluding the pins do nothing.
- There is **no automatic model routing** in Claude Code and no hook can influence model selection. Work only moves off the main thread's model by being delegated to an agent, agents can't spawn further agents, and nothing enforces the delegation — hence `/dev-kit:delegate` for when it actually matters.
- Editing an agent or command file needs `/reload-plugins` (or a restart) before it takes effect; a plain re-read of the file won't do it.
