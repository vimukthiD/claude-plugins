# playwright

Thin wrapper around [Microsoft's `@playwright/mcp`](https://github.com/microsoft/playwright-mcp) browser-automation MCP server. All credit for the server belongs to Microsoft; this plugin only pins the version and sets the flags.

Configured for: headless Chromium, `--isolated` (no persistent browser profile), screenshots/output to `mcp/screenshots` relative to the active project.

## Install

Meant for per-project activation rather than global:

```
claude plugin install playwright@vimukthi-plugins --scope project
```

(`--scope local` to keep it out of the project's committed settings; omit the flag for global. Requires the `vimukthiD/claude-plugins` marketplace — see the [repo README](../../README.md).)

First run on a machine may need the browser binary (verified on 0.0.79, which wants the chrome-for-testing headless shell):

```bash
npx -y @playwright/mcp@0.0.79 install-browser chrome-for-testing
```

0.0.79 pins a newer Chrome for Testing build (v1237) than 0.0.77 did, so this command re-downloads ~272 MiB on a machine that was only set up for the old pin. It affects the `chrome-for-testing` artifact only — `--browser chromium`, which is what this plugin actually launches, uses Playwright's own bundled chromium and is unaffected.

## Supply-chain posture

Unlike the `wikijs` plugin, this one is **not** a committed bundle: `npx` fetches `@playwright/mcp` from the npm registry on first spawn. Bundling isn't practical here — Playwright drives browser binaries it downloads outside npm anyway. The mitigations, stated plainly:

- The version is pinned exactly (`@playwright/mcp@0.0.79`) — no `@latest`, no ranges. Nothing changes until the pin is bumped here.
- It's a first-party Microsoft package.
- Residual risk: no committed lockfile/integrity hash, so this trusts the npm registry to serve the pinned version faithfully.

For comparison, the official `anthropics/claude-plugins-official` ships the same wrapper with `@playwright/mcp@latest` — reviewed 2026-07-05 and deliberately not vendored, because an unpinned `latest` defeats the point of this repo.

## Vetting notes (0.0.79, reviewed 2026-08-08)

- Bumped from 0.0.77 (vetted 2026-07-05). The one change in the 0.0.77 → 0.0.79 span that affects this plugin's configuration is in 0.0.78: "Enable the chromium sandbox for the default browser" — 0.0.77 ran our `--browser chromium` default without the OS sandbox. That fix is the reason for this bump.
- 0.0.79's own security changes are extension/CDP-mode only — Host/Origin validation on the CDP relay WebSocket upgrade, and always passing `noDefaults` for CDP connections (0.0.78). Neither applies to this plugin's stdio, no-extension setup.
- Not CVE remediation: `npm audit` is clean on both 0.0.77 and 0.0.79, and there are no published GitHub security advisories for microsoft/playwright-mcp. CVE-2025-9611 (DNS rebinding) remains the only CVE, fixed at 0.0.40, HTTP-transport-only.
- Supply chain, verified 2026-08-08: no new dependencies and no scope changes (`playwright` + `playwright-core`, 1.62.0-alpha → 1.63.0-alpha); no install/lifecycle scripts in the extracted tarball; npm registry signatures present plus a SLSA v1 provenance attestation, verified by `npm audit signatures`.
- Publisher change since 0.0.77: the `playwright-bot` npm account has been replaced by `microsoft-oss-releases` and `microsoft1es`, with GitHub Actions OIDC trusted publishing as the publisher of record. More auditable than the old bot account, but noted as a change.
- Tool surface grew by exactly one read-only tool, 23 → 24: `browser_find` (accessibility-snapshot text/regex search). Nothing capability-expanding was added and nothing was removed. Verified 2026-08-08 by spawning 0.0.79 over real stdio with this plugin's exact flags — clean `initialize` → `tools/list`, server reports `1.63.0-alpha-2026-08-05`, and `--browser chromium` is still accepted with no warning or substitution despite not appearing in the documented value list (`chrome, firefox, webkit, msedge`).
- Newer hardening flags are available in 0.0.79 and not currently used by this plugin — `--sandbox` / `--no-sandbox`, `--secrets`, `--allowed-origins` / `--blocked-origins`, `--allow-unrestricted-file-access`, `--init-script`. Worth considering for projects that enable this plugin.
- Recency caveat: 0.0.79 was published 2026-08-06, two days before this review.

**Known sharp edge:**

- `browser_run_code_unsafe` is unchanged from 0.0.77 in every respect and remains in the default tool set. Confirmed from the built code, not the docs: it is registered with `capability: "core"`, and the tool filter admits any `core` capability unconditionally. `--caps` only *adds* groups (`vision`, `pdf`, `devtools`) — it cannot remove a tool.
- It still executes via Node's `vm` module inside the Playwright server process. Node's `vm` is not a security boundary. Upstream now documents the tool as "executes arbitrary JavaScript in the Playwright server process and is RCE-equivalent", and states that Playwright MCP is **not** a security boundary — blunter than the framing in the previous vetting note, and the accurate one.
- This is a live exploitation pattern, not a theoretical one: CVE-2026-30957 (OneUptime, CVSS 10.0) is the same mechanism — untrusted code in a Node `vm` with a live Playwright `browser` object, escalated to RCE via `BrowserType.launch({executablePath})`.
- Therefore the per-project deny rule remains **mandatory** and gains nothing from this bump. There is no CLI flag to disable individual tools; if you want it hard-off, add a Claude Code permission **deny** rule in the settings of each project that enables this plugin (plugins can't ship deny rules themselves):

```json
{
  "permissions": {
    "deny": ["mcp__plugin_playwright_playwright__browser_run_code_unsafe"]
  }
}
```

Verified 2026-07-05: with this rule the tool is removed from the session's toolset entirely — it doesn't merely fail at call time, and an `--allowedTools` grant cannot override it.

## Updating the pin

1. Review the upstream release: <https://github.com/microsoft/playwright-mcp/releases>
2. Bump the version in `.mcp.json` args AND `version` in `.claude-plugin/plugin.json` (installs only refresh on a manifest version change).
3. Commit both with a note on what was reviewed.
