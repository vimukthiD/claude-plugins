# wikijs

MCP server for a self-hosted [Wiki.js](https://js.wiki/) instance. Exposes eight page-management tools over stdio: `list_pages`, `get_page`, `search_pages`, `create_page`, `update_page`, `delete_page`, `get_page_tree`, `render_page`. All communication goes to the configured instance's `/graphql` endpoint with Bearer-token auth — no other network destinations.

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

## Rebuilding after a source change

```bash
npm ci
npx esbuild src/index.ts --bundle --platform=node --format=cjs --target=node18 --outfile=server/index.cjs
```

Commit `src/` and `server/index.cjs` together — a bundle change without a matching source change (or vice versa) should fail review.
