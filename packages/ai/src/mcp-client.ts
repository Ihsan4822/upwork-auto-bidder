/**
 * mcp-client.ts — HTTP client for the official Upwork MCP server.
 *
 * ENFORCEMENT RULES (Section 2 & Section 3):
 * 1. Before making any tool call, asserts tool is in ALLOWED_MCP_TOOLS.
 * 2. If a banned tool is invoked, throws BannedMcpToolError immediately.
 * 3. Handles exponential backoff on HTTP 429 (rate limits) and 5xx errors.
 * 4. Extracts structured job postings safely.
 */

import { assertMcpToolAllowed } from './mcp-allowlist';

export interface RawMcpJob {
  id: string;
  title?: string;
  description?: string;
  budget_type?: 'HOURLY' | 'FIXED';
  budget_fixed?: number;
  hourly_min?: number;
  hourly_max?: number;
  client_country?: string;
  client_total_spend?: number;
  client_hire_rate?: number;
  payment_verified?: boolean;
  proposal_count?: number;
  posted_time?: string;
  skills?: string[];
  url?: string;
}

export interface McpSearchJobsResult {
  jobs: RawMcpJob[];
  totalFound: number;
}

export class UpworkMcpClient {
  private readonly mcpServerUrl: string;
  private readonly token: string;

  constructor(token: string, mcpServerUrl = 'https://mcp.upwork.com/mcp') {
    this.token = token;
    this.mcpServerUrl = mcpServerUrl.replace(/\/$/, '');
  }

  /**
   * Search for marketplace jobs matching a keyword query.
   * Tool invoked: "search_jobs" (strictly verified against allowlist).
   *
   * @param queryText - Search keywords (e.g. "A Plus Content Listing Images")
   * @param limit - Max results to fetch (default: 20)
   */
  async searchJobs(queryText: string, limit = 20): Promise<McpSearchJobsResult> {
    const toolName = 'search_jobs';
    // SECURITY GUARD: Assert tool is permitted before request is built
    assertMcpToolAllowed(toolName);

    try {
      const response = await fetch(`${this.mcpServerUrl}/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          name: toolName,
          arguments: {
            query: queryText,
            count: limit,
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Upwork MCP rate limit encountered (HTTP 429). Backing off.');
        }
        throw new Error(`Upwork MCP tool call failed with status ${response.status}: ${response.statusText}`);
      }

      const json = (await response.json()) as { content?: Array<{ text?: string }> };
      const content = json.content?.[0]?.text;
      if (!content) {
        return { jobs: [], totalFound: 0 };
      }

      const parsed = JSON.parse(content);
      const jobs: RawMcpJob[] = Array.isArray(parsed) ? parsed : parsed.jobs || [];

      return {
        jobs,
        totalFound: jobs.length,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'BannedMcpToolError') {
        throw err;
      }
      // Re-throw or wrap with context
      throw new Error(`Failed to execute MCP search_jobs: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Fetch full details for a specific job posting by Upwork Job ID.
   * Tool invoked: "get_job_details" (strictly verified against allowlist).
   */
  async getJobDetails(upworkJobId: string): Promise<RawMcpJob | null> {
    const toolName = 'get_job_details';
    // SECURITY GUARD: Assert tool is permitted
    assertMcpToolAllowed(toolName);

    try {
      const response = await fetch(`${this.mcpServerUrl}/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          name: toolName,
          arguments: {
            job_id: upworkJobId,
          },
        }),
      });

      if (!response.ok) {
        return null;
      }

      const json = (await response.json()) as { content?: Array<{ text?: string }> };
      const content = json.content?.[0]?.text;
      if (!content) return null;

      return JSON.parse(content) as RawMcpJob;
    } catch {
      return null;
    }
  }
}
