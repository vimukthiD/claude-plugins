# playwright

Thin wrapper around [Microsoft's `@playwright/mcp`](https://github.com/microsoft/playwright-mcp) browser-automation MCP server. All credit for the server belongs to Microsoft; this plugin only pins the version and sets the flags.

Configured for: headless Chromium, `--isolated` (no persistent browser profile), screenshots/output to `mcp/screenshots` relative to the active project.

## Install

Meant for per-project activation rather than global:

```
claude plugin install playwright@vimukthi-plugins --scope project
```

(`--scope local` to keep it out of the project's committed settings; omit the flag for global. Requires the `vimukthiD/claude-plugins` marketplace — see the [repo README](../../README.md).)

First run on a machine may need the Chromium binary: `npx playwright install chromium`.

## Supply-chain posture

Unlike the `wikijs` plugin, this one is **not** a committed bundle: `npx` fetches `@playwright/mcp` from the npm registry on first spawn. Bundling isn't practical here — Playwright drives browser binaries it downloads outside npm anyway. The mitigations, stated plainly:

- The version is pinned exactly (`@playwright/mcp@0.0.77`) — no `@latest`, no ranges. Nothing changes until the pin is bumped here.
- It's a first-party Microsoft package.
- Residual risk: no committed lockfile/integrity hash, so this trusts the npm registry to serve the pinned version faithfully.

For comparison, the official `anthropics/claude-plugins-official` ships the same wrapper with `@playwright/mcp@latest` — reviewed 2026-07-05 and deliberately not vendored, because an unpinned `latest` defeats the point of this repo.

## Vetting notes (0.0.77, reviewed 2026-07-05)

- Release cadence and publishers are healthy: Playwright core team + Microsoft's release bot. Only known CVE (2025-9611, DNS rebinding) was fixed at 0.0.40 and doesn't apply to stdio transport.
- 0.0.76/0.0.77 add real hardening over 0.0.75: path-traversal checks on static file serving, secrets redacted from console-log artifacts, data-URLs excluded from snapshots. File access is workspace-root-restricted and `file://` navigation blocked by default.
- Verified by spawning 0.0.77 with this exact config: initializes cleanly, advertises 23 tools.
- **Known sharp edge:** the default tool surface includes `browser_run_code_unsafe`, which executes Playwright-API JavaScript in a Node `vm` — escapable by design (upstream closed the RCE report by renaming the tool to say so). Same tool exists in 0.0.75, so this is not new exposure, and the realistic vector is prompt injection from a hostile page steering the agent into calling it. There is no CLI flag to disable individual tools; if you want it hard-off, add a Claude Code permission **deny** rule for that tool in the project's settings.

## Updating the pin

1. Review the upstream release: <https://github.com/microsoft/playwright-mcp/releases>
2. Bump the version in `.mcp.json` args AND `version` in `.claude-plugin/plugin.json` (installs only refresh on a manifest version change).
3. Commit both with a note on what was reviewed.
