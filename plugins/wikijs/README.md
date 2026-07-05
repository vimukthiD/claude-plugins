# wikijs

MCP server for a self-hosted [Wiki.js](https://js.wiki/) instance. Exposes eight page-management tools over stdio: `list_pages`, `get_page`, `search_pages`, `create_page`, `update_page`, `delete_page`, `get_page_tree`, `render_page`. All communication goes to the configured instance's `/graphql` endpoint with Bearer-token auth — no other network destinations.

## Install

```
/plugin install wikijs@vimukthi-plugins
```

Or from a shell: `claude plugin install wikijs@vimukthi-plugins` (add `--scope project` to enable it only for the current project). Requires the `vimukthiD/claude-plugins` marketplace to be registered first — see the [repo README](../../README.md).

## Configuration

No credentials live in this repo. The server reads its config from, in order:

1. Environment variables: `WIKIJS_URL` and `WIKIJS_API_KEY`
2. `~/.wikijs-mcp/config.json` (recommended; `chmod 600` it):

```json
{
  "baseUrl": "http://your-wiki-host:3000",
  "apiKey": "your-api-key"
}
```

The API key comes from Wiki.js **Administration → API Access**.

## Layout

- `server/index.cjs` — the runnable artifact: `src/` bundled into a single self-contained file (no `node_modules` needed at runtime). Unminified so it stays reviewable.
- `src/` — the TypeScript source of truth.

## Supply-chain posture

- **Runtime never touches npm.** Installing and running this plugin executes only the committed bundle — no dependency fetch, no install scripts.
- **Everything is pinned exactly.** All dependencies — including the `esbuild` build tool — are exact versions in `package.json` (no `^`/`~` ranges), and `package-lock.json` carries an integrity hash for every package.
- **Rebuild only via `npm ci --ignore-scripts`**, never `npm install`: `ci` installs exactly what the lockfile says and fails on any mismatch; `--ignore-scripts` blocks install-time lifecycle scripts (the classic npm attack vector). esbuild works without its scripts — its platform binary ships as a regular optional dependency.

## Rebuilding after a source change

```bash
npm ci --ignore-scripts
npm run bundle
```

Commit `src/` and `server/index.cjs` together — a bundle change without a matching source change (or vice versa) should fail review.

## Updating a dependency (deliberately)

1. Edit the exact pin in `package.json`.
2. `npm install --package-lock-only --ignore-scripts` to regenerate the lockfile.
3. Review the lockfile diff, then rebuild and re-test.
4. Commit `package.json`, `package-lock.json`, and `server/index.cjs` together with a note on why the bump happened.
