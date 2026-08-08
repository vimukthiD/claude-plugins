# plane

Thin wrapper around [Plane's official MCP server](https://github.com/makeplane/plane-mcp-server) (`makeplane/plane-mcp-server`). All credit for the server belongs to Plane; this plugin only pins the image by digest, hardens the container, wires credentials through the environment, and ships deny profiles.

Runs the upstream Docker image — **pinned by digest**, rootless, read-only filesystem, stdio transport.

## Requirements

- **Docker** running locally. The image is multi-arch (`linux/amd64` + `linux/arm64`).
- **Plane 1.4.1 or later.** This is a hard floor, not a suggestion — see [Plane version floor](#plane-version-floor).
- A Plane **personal access token**.

## Install

Meant for per-project activation, because the workspace is per-project:

```
claude plugin install plane@vimukthi-plugins --scope project
```

(`--scope local` to keep it out of the project's committed settings; omit the flag for global. Requires the `vimukthiD/claude-plugins` marketplace — see the [repo README](../../README.md).)

Then do both of the following. Neither is optional:

1. [Configure credentials and workspace](#configuration) — the server starts without them and fails confusingly.
2. [Apply a deny profile](#deny-profiles) — plugins cannot ship deny rules, so an unconfigured install exposes all 177 tools including 13 live `delete_*` tools.

## Configuration

Three environment variables, all read from the environment at spawn time. Nothing is committed here.

| Variable | Required | Value |
|---|---|---|
| `PLANE_API_KEY` | yes | Personal access token |
| `PLANE_WORKSPACE_SLUG` | yes | The workspace this project works against |
| `PLANE_BASE_URL` | yes | Origin only, no path — e.g. `https://plane.example.com` |

`PLANE_BASE_URL` is the bare origin. The SDK appends `/api/v1` itself; adding it yourself produces 404s on every call.

### Getting a token

Profile settings → **Personal Access Tokens** → **Add personal access token** (`https://<your-plane>/profile/api-tokens`). Set an expiry. The token is shown once.

A PAT inherits the full permissions of the account that created it — there is no scoping and no read-only flag. Since this server's tool surface includes `delete_project`, consider generating the token from a dedicated Plane user invited as **Member** rather than Admin. Member cannot delete projects or the workspace, which caps the blast radius independently of the deny profile.

### Storing credentials

The token is machine-local and never belongs in a repo. Keep it outside:

```bash
mkdir -p ~/.plane-mcp && chmod 700 ~/.plane-mcp
printf 'PLANE_API_KEY=%s\n' 'plane_api_xxx' > ~/.plane-mcp/env
chmod 600 ~/.plane-mcp/env
```

### Setting the workspace (per project)

**One server process serves exactly one workspace.** The slug is fixed when the process starts: none of the 177 tools accept a workspace argument, and `list_projects` takes only pagination parameters. This is why the plugin is project-scoped — each project points at the workspace it belongs to.

A PAT works across every workspace its account belongs to, so **only the slug changes between projects**, never the token.

Per project, via [direnv](https://direnv.net) `.envrc`, a shell profile, or however you already manage per-project env:

```bash
source ~/.plane-mcp/env                       # PLANE_API_KEY — shared
export PLANE_WORKSPACE_SLUG=this-projects-workspace
export PLANE_BASE_URL=https://plane.example.com
```

Find the slug in the Plane URL — it is the segment right after the host:

```
https://plane.example.com/<workspace-slug>/projects/...
```

The REST API has no list-workspaces endpoint, so the URL is the reliable source.

### Switching workspace

Change `PLANE_WORKSPACE_SLUG` and restart the session (or `/reload-plugins`). The value is read when the container spawns, so an edit mid-session has no effect until the server restarts.

### Serving several workspaces at once

Only worth it if you genuinely need cross-workspace work in a single session. Add a second server entry locally — in the project's `.mcp.json`, not in this plugin — with a distinct server name and a hardcoded slug:

```json
{
  "mcpServers": {
    "plane-other": {
      "type": "stdio",
      "command": "docker",
      "args": ["run", "-i", "--rm", "--user", "65534:65534", "--read-only",
               "-e", "PLANE_API_KEY", "-e", "PLANE_BASE_URL",
               "makeplane/plane-mcp-server@sha256:1feb49a963de0e3e3a2178cd86c4b388c19ef7fddfd15a95f81f6bd71cb7a95e",
               "stdio"],
      "env": {
        "PLANE_API_KEY": "${PLANE_API_KEY}",
        "PLANE_WORKSPACE_SLUG": "the-other-workspace",
        "PLANE_BASE_URL": "${PLANE_BASE_URL}"
      }
    }
  }
}
```

Costs, per additional workspace: another container process per session, ~2,300 more context tokens, and **its own copy of the deny profile** — the rules are keyed by server name, so `mcp__plugin_plane_plane__*` does not cover `plane-other`. Rewrite the prefix when you copy the profile.

## Deny profiles

Plugins cannot ship permission rules, so these have to be copied into each project that enables the plugin. A deny rule removes the tool from the session's toolset entirely — it does not merely fail at call time, and an `--allowedTools` grant cannot override it.

| Profile | Denies | Leaves | Use when |
|---|---|---|---|
| **`profile-b-readwrite.json`** (default) | 105 | 72 — 36 read + 36 write | Normal use. Read and write work items, cycles, modules, comments. **All 13 live `delete_*` tools blocked.** |
| `profile-a-readonly.json` | 141 | 36 read | Plane as a queryable source with zero write authority. |

Both profiles also deny the 92 tools that are unusable on Plane Community (see [Tool surface](#tool-surface)) — dead tools waste turns and schema-loading tokens on failures.

### Applying a profile

Merge the profile's `deny` array into the project's `.claude/settings.json`:

```bash
python3 - <<'EOF'
import json, pathlib
prof = json.load(open("plugins/plane/deny-profiles/profile-b-readwrite.json"))
p = pathlib.Path(".claude/settings.json")
s = json.loads(p.read_text()) if p.exists() else {}
perms = s.setdefault("permissions", {})
deny = perms.setdefault("deny", [])
existing = {d for d in deny if not d.startswith("mcp__plugin_plane_plane__")}
perms["deny"] = sorted(existing | set(prof["permissions"]["deny"]))
p.parent.mkdir(exist_ok=True)
p.write_text(json.dumps(s, indent=2) + "\n")
print(f"applied: {len(perms['deny'])} deny rules")
EOF
```

Adjust the profile path to wherever this repo is checked out. Re-running with the other profile filename swaps profiles cleanly — it drops all existing `mcp__plugin_plane_plane__*` rules before adding the new set.

### Switching profiles

Run the same snippet with the other filename, then restart the session. Verify with `ToolSearch` for a tool that should be gone:

```
Use ToolSearch to look for 'plane delete_work_item'.
```

Under either profile it must come back not-found.

### Loosening a single tool

Delete that one entry from the `deny` array in `.claude/settings.json` — do not edit the profile files, or the next merge will reintroduce it. Re-applying a profile overwrites hand edits inside the `mcp__plugin_plane_plane__*` namespace.

## Plane version floor

**Plane 1.4.1 or later.** Verified the hard way: on Plane 1.3.1, `list_projects` and 20 other read tools return HTTP 404, because v0.2.10 migrated to `/projects-lite/` and similar endpoints that 1.3.1 does not route. The classic `/projects/` endpoint works fine on 1.3.1 — the server simply stops calling it.

Measured on the same instance and token, read-only tools only:

| Plane | Server | Working | 404 |
|---|---|---|---|
| 1.3.1 | v0.2.11 | 8 | 21 |
| 1.3.1 | v0.2.9 | 13 | 9 |
| **1.4.1** | **v0.2.11** | **19** | 20 |

If a future server version raises the floor again, the symptom is the same: core tools like `list_projects` returning 404 while the REST API answers fine to `curl`.

## Tool surface

177 tools, of which **92 are unusable on Plane Community** — Customers and Milestones are Business-tier, work item types and worklogs are Pro, and Initiatives, Releases, Pages, Roles, Estimates and Relations all return 404 on Community 1.4.1.

Context cost is not the concern it looks like: Claude Code defers MCP tool schemas, so all 177 cost **+2,339 tokens** (names only, ~14 each). Full schemas load on demand via `ToolSearch`. Denying dead families still matters — for safety, for turn-wasting failures, and because loading an unused schema mid-task is charged per use (the intake tools are ~5,600 tokens each).

The 92 figure is partly inferred: one read tool per family was confirmed 404 against a live Community 1.4.1 instance and extrapolated to that family's writes and deletes. No write or delete tool was called during vetting.

## Supply-chain posture

Weaker than `wikijs` (a committed bundle), differently shaped from `playwright` (one pinned npm package). Stated plainly:

- **Pinned by digest**, not tag — `sha256:1feb49a9…7a95e`, content-addressed and immutable. Stronger than a version pin, which trusts a registry to keep serving the same bytes.
- **Commit-traceable.** The image carries a buildkit SLSA provenance v1 attestation naming `vcs:source github.com/makeplane/plane-mcp-server` and `vcs:revision 96cf4d51d65cfa5e47d10ff7a4a4caba3b7a98d1`. That commit exists upstream ("chore: bump version from 0.2.10 to 0.2.11 #186") and GitHub reports its commit signature as verified.
- **Not signed.** There is no cosign/sigstore signature — no `.sig` tags across any of the 34 published tags, and no signing step in upstream's `build-branch.yml`. The provenance attestation is itself an unsigned JSON blob with an empty `builder.id`, so anyone with push rights could have written it. Treat it as informative; the trust anchor is Docker Hub's ACL on the `makeplane` org, not cryptography.
- **Build is not reproducible.** Upstream's Dockerfile uses `FROM python:3.11-slim` and `COPY --from=ghcr.io/astral-sh/uv:latest`, both mutable tags, and `uv pip install --system .` resolves from `pyproject.toml` without consuming the `uv.lock` it copies in. Moot while the output digest is pinned; it means you cannot rebuild this digest yourself.
- **Runs as root upstream** — no `USER` directive. This plugin overrides with `--user 65534:65534 --read-only`, verified working against a live instance.

## Vetting notes (v0.2.11, reviewed 2026-08-08)

Verified against a live self-hosted Plane 1.4.1 Community instance with a real token:

- Image pulled by digest; `docker run -i --rm --user 65534:65534 --read-only … stdio` initializes cleanly on protocol `2025-06-18` and advertises 177 tools.
- Interior: Python 3.11.15, `plane-mcp-server` 0.2.11, `plane-sdk` 0.2.20, 310 MB.
- End-to-end confirmed: `list_projects` through the container returns real project data. `--network none` correctly breaks it, proving the hardening flags take effect.
- Read-only sweep of 39 probeable tools: 19 work, 20 return 404. No write or delete tool was invoked.
- **Sharp edge — tool-surface drift.** v0.2.10 → v0.2.11 added **38 tools and removed none**, including 6 new `delete_*`, in a patch release. A digest bump can silently widen the surface, and a deny profile written by exclusion goes stale in the dangerous direction. Re-diff the tool list on every bump, not just the changelog.

## Updating the pin

1. Review upstream: <https://github.com/makeplane/plane-mcp-server/releases> and the commit named in the new image's provenance.
2. Resolve the new digest and confirm the tag maps to it:
   ```bash
   TOK=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:makeplane/plane-mcp-server:pull" | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
   curl -sI -H "Authorization: Bearer $TOK" \
     -H "Accept: application/vnd.oci.image.index.v1+json" \
     "https://registry-1.docker.io/v2/makeplane/plane-mcp-server/manifests/vX.Y.Z" \
     | grep -i docker-content-digest
   ```
3. **Diff the tool list** against the current pin — new tools are denied by default only if you regenerate the profiles. Regenerate both, paying attention to new `delete_*` entries and to families that have become available.
4. Re-run a read-only sweep against the live instance to confirm the version floor has not moved.
5. Bump the digest in `.mcp.json` AND `version` in `.claude-plugin/plugin.json` (installs only refresh on a manifest version change), and update the digest in this README's two code blocks and the vetting date.
6. Commit with a note on what was reviewed, the tool-count delta, and the new floor.

## Troubleshooting

**Every call fails with `MissingSchema: Invalid URL '${PLANE_BASE_URL}/api/v1/...'`** — the environment variables are not set in the shell that launched Claude Code. Unset `${VAR}` references are passed through **literally**, so the container starts and the tools appear; only the first call fails. Check with `echo $PLANE_WORKSPACE_SLUG` in the same shell, then restart the session.

**`HTTP 403: Given API token is not valid`** — token is wrong, expired, or revoked. Confirm with:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "X-API-Key: $PLANE_API_KEY" \
  "$PLANE_BASE_URL/api/v1/users/me/"
```

**`HTTP 404` on a tool that should exist** — either the feature is Community-gated (expected; deny it) or your Plane predates the endpoint. Check the same resource directly with `curl`; if `curl` succeeds where the tool 404s, it is a [version floor](#plane-version-floor) problem.

**Writes fail with `error code: 1010` behind Cloudflare** — Cloudflare bot-signature blocking, not Plane. It rejects the `Python-urllib` User-Agent on POST while allowing GET. Does not affect this plugin (the SDK uses `python-requests`, which passes), but it will bite any `urllib`-based script you write against the same host.
