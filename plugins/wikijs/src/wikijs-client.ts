/**
 * Wiki.js GraphQL API Client
 *
 * Handles all communication with the Wiki.js GraphQL endpoint.
 * Authentication is done via Bearer token (API key generated in Wiki.js Admin > API Access).
 */

export interface WikiJsConfig {
  /** Base URL of your Wiki.js instance, e.g. "http://192.168.1.100:3000" */
  baseUrl: string;
  /** API key generated from Wiki.js Administration > API Access */
  apiKey: string;
}

export interface PageListItem {
  id: number;
  path: string;
  title: string;
  description: string;
  locale: string;
  contentType: string;
  isPublished: boolean;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PageDetail extends PageListItem {
  content: string;
  tags: { tag: string }[];
  editor: string;
}

export interface SearchResult {
  results: {
    id: string;
    title: string;
    path: string;
    description: string;
    locale: string;
  }[];
  suggestions: string[];
  totalHits: number;
}

export interface ResponseResult {
  succeeded: boolean;
  errorCode: number;
  slug: string;
  message: string;
}

export interface CreatePageInput {
  title: string;
  content: string;
  description?: string;
  editor?: string;
  locale?: string;
  path: string;
  isPublished?: boolean;
  isPrivate?: boolean;
  tags?: string[];
}

export interface UpdatePageInput {
  id: number;
  title?: string;
  content?: string;
  description?: string;
  editor?: string;
  locale?: string;
  isPublished?: boolean;
  isPrivate?: boolean;
  tags?: string[];
}

export class WikiJsClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: WikiJsConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}/graphql`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Wiki.js API error (HTTP ${response.status}): ${text}`);
    }

    const json = await response.json() as { data?: T; errors?: { message: string }[] };

    if (json.errors && json.errors.length > 0) {
      throw new Error(`Wiki.js GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`);
    }

    if (!json.data) {
      throw new Error("Wiki.js API returned no data");
    }

    return json.data;
  }

  /**
   * List all pages, optionally filtered by locale
   */
  async listPages(locale?: string): Promise<PageListItem[]> {
    const query = `
      query {
        pages {
          list (orderBy: TITLE) {
            id
            path
            title
            description
            locale
            contentType
            isPublished
            isPrivate
            createdAt
            updatedAt
          }
        }
      }
    `;

    const data = await this.graphql<{ pages: { list: PageListItem[] } }>(query);
    let pages = data.pages.list;

    if (locale) {
      pages = pages.filter((p) => p.locale === locale);
    }

    return pages;
  }

  /**
   * Get a single page by ID with full content
   */
  async getPage(id: number): Promise<PageDetail> {
    const query = `
      query ($id: Int!) {
        pages {
          single (id: $id) {
            id
            path
            title
            description
            locale
            contentType
            content
            isPublished
            isPrivate
            createdAt
            updatedAt
            editor
            tags {
              tag
            }
          }
        }
      }
    `;

    const data = await this.graphql<{ pages: { single: PageDetail } }>(query, { id });

    if (!data.pages.single) {
      throw new Error(`Page with ID ${id} not found`);
    }

    return data.pages.single;
  }

  /**
   * Get a page by its path and locale
   */
  async getPageByPath(path: string, locale: string = "en"): Promise<PageDetail> {
    // Remove leading slash if present
    const cleanPath = path.replace(/^\//, "");

    const query = `
      query ($path: String!, $locale: String!) {
        pages {
          singleByPath (path: $path, locale: $locale) {
            id
            path
            title
            description
            locale
            contentType
            content
            isPublished
            isPrivate
            createdAt
            updatedAt
            editor
            tags {
              tag
            }
          }
        }
      }
    `;

    const data = await this.graphql<{ pages: { singleByPath: PageDetail } }>(query, {
      path: cleanPath,
      locale,
    });

    if (!data.pages.singleByPath) {
      throw new Error(`Page not found at path: ${cleanPath} (locale: ${locale})`);
    }

    return data.pages.singleByPath;
  }

  /**
   * Search pages by query string
   */
  async searchPages(searchQuery: string): Promise<SearchResult> {
    const query = `
      query ($query: String!) {
        pages {
          search (query: $query) {
            results {
              id
              title
              path
              description
              locale
            }
            suggestions
            totalHits
          }
        }
      }
    `;

    const data = await this.graphql<{ pages: { search: SearchResult } }>(query, {
      query: searchQuery,
    });

    return data.pages.search;
  }

  /**
   * Create a new page
   */
  async createPage(input: CreatePageInput): Promise<{ responseResult: ResponseResult; page?: { id: number; path: string } }> {
    // Remove leading slash from path
    const cleanPath = input.path.replace(/^\//, "");

    const query = `
      mutation (
        $title: String!
        $content: String!
        $description: String!
        $editor: String!
        $isPublished: Boolean!
        $isPrivate: Boolean!
        $locale: String!
        $path: String!
        $tags: [String]!
      ) {
        pages {
          create (
            title: $title
            content: $content
            description: $description
            editor: $editor
            isPublished: $isPublished
            isPrivate: $isPrivate
            locale: $locale
            path: $path
            tags: $tags
          ) {
            responseResult {
              succeeded
              errorCode
              slug
              message
            }
            page {
              id
              path
            }
          }
        }
      }
    `;

    const variables = {
      title: input.title,
      content: input.content,
      description: input.description || "",
      editor: input.editor || "markdown",
      isPublished: input.isPublished ?? true,
      isPrivate: input.isPrivate ?? false,
      locale: input.locale || "en",
      path: cleanPath,
      tags: input.tags || [],
    };

    const data = await this.graphql<{
      pages: { create: { responseResult: ResponseResult; page?: { id: number; path: string } } };
    }>(query, variables);

    return data.pages.create;
  }

  /**
   * Update an existing page
   */
  async updatePage(input: UpdatePageInput): Promise<{ responseResult: ResponseResult; page?: { id: number; path: string } }> {
    const query = `
      mutation (
        $id: Int!
        $title: String
        $content: String
        $description: String
        $editor: String
        $isPublished: Boolean
        $isPrivate: Boolean
        $locale: String
        $tags: [String]
      ) {
        pages {
          update (
            id: $id
            title: $title
            content: $content
            description: $description
            editor: $editor
            isPublished: $isPublished
            isPrivate: $isPrivate
            locale: $locale
            tags: $tags
          ) {
            responseResult {
              succeeded
              errorCode
              slug
              message
            }
            page {
              id
              path
            }
          }
        }
      }
    `;

    const data = await this.graphql<{
      pages: { update: { responseResult: ResponseResult; page?: { id: number; path: string } } };
    }>(query, input as unknown as Record<string, unknown>);

    return data.pages.update;
  }

  /**
   * Delete a page by ID
   */
  async deletePage(id: number): Promise<ResponseResult> {
    const query = `
      mutation ($id: Int!) {
        pages {
          delete (id: $id) {
            responseResult {
              succeeded
              errorCode
              slug
              message
            }
          }
        }
      }
    `;

    const data = await this.graphql<{
      pages: { delete: { responseResult: ResponseResult } };
    }>(query, { id });

    return data.pages.delete.responseResult;
  }

  /**
   * Re-render a page (useful after content updates)
   */
  async renderPage(id: number): Promise<ResponseResult> {
    const query = `
      mutation ($id: Int!) {
        pages {
          render (id: $id) {
            responseResult {
              succeeded
              errorCode
              slug
              message
            }
          }
        }
      }
    `;

    const data = await this.graphql<{
      pages: { render: { responseResult: ResponseResult } };
    }>(query, { id });

    return data.pages.render.responseResult;
  }

  /**
   * Get the tree structure of pages (for navigation)
   */
  async getPageTree(parentId?: number, locale: string = "en"): Promise<
    { id: number; path: string; title: string; isFolder: boolean; depth: number }[]
  > {
    const query = `
      query ($parent: Int, $locale: String!) {
        pages {
          tree (parent: $parent, mode: ALL, locale: $locale) {
            id
            path
            title
            isFolder
            depth
          }
        }
      }
    `;

    const data = await this.graphql<{
      pages: {
        tree: { id: number; path: string; title: string; isFolder: boolean; depth: number }[];
      };
    }>(query, { parent: parentId ?? 0, locale });

    return data.pages.tree;
  }
}
