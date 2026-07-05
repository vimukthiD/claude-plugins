#!/usr/bin/env node
/**
 * Wiki.js MCP Server
 *
 * Exposes Wiki.js page management as MCP tools that can be used by Claude
 * and other MCP-compatible AI assistants.
 *
 * Configuration via environment variables:
 *   WIKIJS_URL  - Base URL of your Wiki.js instance (e.g. http://192.168.1.100:3000)
 *   WIKIJS_API_KEY - API key from Wiki.js Admin > API Access
 *
 * Or via config file at ~/.wikijs-mcp/config.json:
 *   { "baseUrl": "http://...", "apiKey": "..." }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { WikiJsClient, type WikiJsConfig } from "./wikijs-client.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function loadConfig(): WikiJsConfig {
  // 1. Try environment variables first
  if (process.env.WIKIJS_URL && process.env.WIKIJS_API_KEY) {
    return {
      baseUrl: process.env.WIKIJS_URL,
      apiKey: process.env.WIKIJS_API_KEY,
    };
  }

  // 2. Try config file
  const configPath = join(homedir(), ".wikijs-mcp", "config.json");
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.baseUrl && parsed.apiKey) {
        return { baseUrl: parsed.baseUrl, apiKey: parsed.apiKey };
      }
    } catch {
      // Fall through to error
    }
  }

  console.error(
    "Wiki.js MCP Server: Missing configuration.\n" +
      "Set WIKIJS_URL and WIKIJS_API_KEY environment variables,\n" +
      `or create a config file at ${join(homedir(), ".wikijs-mcp", "config.json")}\n` +
      'with: { "baseUrl": "http://your-wiki:3000", "apiKey": "your-api-key" }'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const config = loadConfig();
const client = new WikiJsClient(config);

const server = new McpServer({
  name: "wikijs",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

// --- list_pages ---
server.tool(
  "list_pages",
  "List all pages in the Wiki.js instance. Optionally filter by locale.",
  {
    locale: z
      .string()
      .optional()
      .describe('Filter by locale code, e.g. "en", "de", "ja"'),
  },
  async ({ locale }) => {
    try {
      const pages = await client.listPages(locale);

      const summary = pages
        .map(
          (p) =>
            `[${p.id}] ${p.title} (/${p.path}) - ${p.isPublished ? "published" : "draft"}${p.isPrivate ? " [private]" : ""}`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${pages.length} page(s):\n\n${summary}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error listing pages: ${error}` }],
        isError: true,
      };
    }
  }
);

// --- get_page ---
server.tool(
  "get_page",
  "Get the full content of a Wiki.js page by its ID or path.",
  {
    id: z.number().optional().describe("Page ID (integer). Use this or path, not both."),
    path: z
      .string()
      .optional()
      .describe('Page path, e.g. "home" or "guides/setup". Use this or id, not both.'),
    locale: z.string().optional().default("en").describe("Locale code (default: en)"),
  },
  async ({ id, path, locale }) => {
    try {
      let page;
      if (id !== undefined) {
        page = await client.getPage(id);
      } else if (path) {
        page = await client.getPageByPath(path, locale);
      } else {
        return {
          content: [{ type: "text" as const, text: "Error: Provide either 'id' or 'path'" }],
          isError: true,
        };
      }

      const tags = page.tags?.map((t) => t.tag).join(", ") || "none";

      const text = [
        `# ${page.title}`,
        `**ID:** ${page.id} | **Path:** /${page.path} | **Locale:** ${page.locale}`,
        `**Editor:** ${page.editor} | **Published:** ${page.isPublished} | **Private:** ${page.isPrivate}`,
        `**Tags:** ${tags}`,
        `**Created:** ${page.createdAt} | **Updated:** ${page.updatedAt}`,
        ``,
        `---`,
        ``,
        page.content,
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error getting page: ${error}` }],
        isError: true,
      };
    }
  }
);

// --- search_pages ---
server.tool(
  "search_pages",
  "Search for pages in Wiki.js by keyword or phrase.",
  {
    query: z.string().describe("Search query string"),
  },
  async ({ query }) => {
    try {
      const result = await client.searchPages(query);

      if (result.totalHits === 0) {
        return {
          content: [{ type: "text" as const, text: `No results found for: "${query}"` }],
        };
      }

      const lines = result.results.map(
        (r) => `[${r.id}] ${r.title} (/${r.path}) - ${r.description || "no description"}`
      );

      const text = [
        `Found ${result.totalHits} result(s) for "${query}":`,
        "",
        ...lines,
        "",
        result.suggestions.length > 0
          ? `Suggestions: ${result.suggestions.join(", ")}`
          : "",
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error searching: ${error}` }],
        isError: true,
      };
    }
  }
);

// --- create_page ---
server.tool(
  "create_page",
  "Create a new page in Wiki.js. Content should be markdown by default.",
  {
    title: z.string().describe("Page title"),
    content: z.string().describe("Page content (markdown by default)"),
    path: z
      .string()
      .describe('Page path without leading slash, e.g. "guides/new-feature"'),
    description: z.string().optional().describe("Short description of the page"),
    editor: z
      .enum(["markdown", "code", "ckeditor", "asciidoc"])
      .optional()
      .default("markdown")
      .describe("Editor type (default: markdown)"),
    locale: z.string().optional().default("en").describe("Locale code (default: en)"),
    isPublished: z.boolean().optional().default(true).describe("Whether the page is published (default: true)"),
    isPrivate: z.boolean().optional().default(false).describe("Whether the page is private (default: false)"),
    tags: z.array(z.string()).optional().describe("Tags to apply to the page"),
  },
  async (input) => {
    try {
      const result = await client.createPage({
        title: input.title,
        content: input.content,
        path: input.path,
        description: input.description,
        editor: input.editor,
        locale: input.locale,
        isPublished: input.isPublished,
        isPrivate: input.isPrivate,
        tags: input.tags,
      });

      if (result.responseResult.succeeded) {
        const pageUrl = `${config.baseUrl}/${input.locale || "en"}/${input.path}`;
        return {
          content: [
            {
              type: "text" as const,
              text: `Page created successfully!\n\n**ID:** ${result.page?.id}\n**Path:** /${result.page?.path}\n**URL:** ${pageUrl}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create page: ${result.responseResult.message} (code: ${result.responseResult.errorCode})`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error creating page: ${error}` }],
        isError: true,
      };
    }
  }
);

// --- update_page ---
server.tool(
  "update_page",
  "Update an existing Wiki.js page. Only the fields you provide will be changed.",
  {
    id: z.number().describe("Page ID to update"),
    title: z.string().optional().describe("New title"),
    content: z.string().optional().describe("New content (markdown)"),
    description: z.string().optional().describe("New description"),
    editor: z
      .enum(["markdown", "code", "ckeditor", "asciidoc"])
      .optional()
      .describe("Editor type"),
    locale: z.string().optional().describe("Locale code"),
    isPublished: z.boolean().optional().describe("Published state"),
    isPrivate: z.boolean().optional().describe("Private state"),
    tags: z.array(z.string()).optional().describe("Replace tags"),
  },
  async (input) => {
    try {
      const result = await client.updatePage(input);

      if (result.responseResult.succeeded) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Page ${input.id} updated successfully!\n**Path:** /${result.page?.path}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to update page: ${result.responseResult.message} (code: ${result.responseResult.errorCode})`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error updating page: ${error}` }],
        isError: true,
      };
    }
  }
);

// --- delete_page ---
server.tool(
  "delete_page",
  "Delete a Wiki.js page by its ID. This action is irreversible.",
  {
    id: z.number().describe("Page ID to delete"),
  },
  async ({ id }) => {
    try {
      const result = await client.deletePage(id);

      if (result.succeeded) {
        return {
          content: [{ type: "text" as const, text: `Page ${id} deleted successfully.` }],
        };
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to delete page: ${result.message} (code: ${result.errorCode})`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error deleting page: ${error}` }],
        isError: true,
      };
    }
  }
);

// --- get_page_tree ---
server.tool(
  "get_page_tree",
  "Get the page tree (folder structure) of the wiki. Useful for understanding how content is organized.",
  {
    parentId: z.number().optional().describe("Parent page ID to get subtree (omit for root)"),
    locale: z.string().optional().default("en").describe("Locale code (default: en)"),
  },
  async ({ parentId, locale }) => {
    try {
      const tree = await client.getPageTree(parentId, locale);

      if (tree.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No pages found in this tree." }],
        };
      }

      const lines = tree.map((node) => {
        const indent = "  ".repeat(node.depth);
        const icon = node.isFolder ? "📁" : "📄";
        return `${indent}${icon} [${node.id}] ${node.title} (/${node.path})`;
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Page tree:\n\n${lines.join("\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error getting page tree: ${error}` }],
        isError: true,
      };
    }
  }
);

// --- render_page ---
server.tool(
  "render_page",
  "Re-render a Wiki.js page. Useful after updating content to ensure proper rendering.",
  {
    id: z.number().describe("Page ID to re-render"),
  },
  async ({ id }) => {
    try {
      const result = await client.renderPage(id);

      if (result.succeeded) {
        return {
          content: [{ type: "text" as const, text: `Page ${id} re-rendered successfully.` }],
        };
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to render page: ${result.message} (code: ${result.errorCode})`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error rendering page: ${error}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Wiki.js MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
