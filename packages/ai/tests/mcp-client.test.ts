import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpworkMcpClient } from '../src/mcp-client';

interface McpRpcRequest {
  jsonrpc?: string;
  id?: number | string;
  method?: string;
  params?: {
    name?: string;
    arguments?: {
      org_uid?: string;
      params?: {
        limit?: number;
        job_id?: string;
      };
    };
  };
}

describe('UpworkMcpClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('clamps searchJobs limit to maximum of 10 for live upwork.com calls', async () => {
    let capturedBody: McpRpcRequest | null = null;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      // 1. Initialize session
      if (init?.body && (JSON.parse(init.body as string) as McpRpcRequest).method === 'initialize') {
        return {
          ok: true,
          headers: new Headers({ 'mcp-session-id': 'test-session-123' }),
          text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }),
        };
      }

      // 2. list_accounts
      if (
        init?.body &&
        (JSON.parse(init.body as string) as McpRpcRequest).params?.name === 'upwork__list_accounts'
      ) {
        return {
          ok: true,
          headers: new Headers(),
          text: async () =>
            JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              result: {
                content: [
                  {
                    text: JSON.stringify({
                      accounts: [{ role: 'TALENT', name: 'Farid Malik', org_uid: 'org_123' }],
                    }),
                  },
                ],
              },
            }),
        };
      }

      // 3. find_jobs
      if (
        init?.body &&
        (JSON.parse(init.body as string) as McpRpcRequest).params?.name === 'upwork__find_jobs'
      ) {
        capturedBody = JSON.parse(init.body as string) as McpRpcRequest;
        return {
          ok: true,
          headers: new Headers(),
          text: async () =>
            JSON.stringify({
              jsonrpc: '2.0',
              id: 3,
              result: {
                content: [
                  {
                    text: JSON.stringify({
                      jobs: [
                        {
                          id: 'job_1',
                          title: 'Amazon A+ Content',
                          job_type: 'FIXED',
                          budget: 200,
                        },
                      ],
                    }),
                  },
                ],
              },
            }),
        };
      }

      return {
        ok: true,
        headers: new Headers(),
        text: async () => JSON.stringify({ jsonrpc: '2.0', id: 99, result: {} }),
      };
    }) as unknown as typeof fetch;

    const client = new UpworkMcpClient('test-token', 'https://mcp.upwork.com/mcp', 'Farid Malik');
    const result = await client.searchJobs('Amazon design', 25);

    expect(capturedBody).not.toBeNull();
    expect(capturedBody?.params?.arguments?.params?.limit).toBe(10);
    expect(result.jobs.length).toBe(1);
    expect(result.jobs[0].title).toBe('Amazon A+ Content');
  });

  it('throws an error when searchJobs encounters a JSON-RPC error response', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.body && (JSON.parse(init.body as string) as McpRpcRequest).method === 'initialize') {
        return {
          ok: true,
          headers: new Headers({ 'mcp-session-id': 'test-session-123' }),
          text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }),
        };
      }

      if (
        init?.body &&
        (JSON.parse(init.body as string) as McpRpcRequest).params?.name === 'upwork__list_accounts'
      ) {
        return {
          ok: true,
          headers: new Headers(),
          text: async () =>
            JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              result: {
                content: [
                  {
                    text: JSON.stringify({
                      accounts: [{ role: 'TALENT', name: 'Farid Malik', org_uid: 'org_123' }],
                    }),
                  },
                ],
              },
            }),
        };
      }

      if (
        init?.body &&
        (JSON.parse(init.body as string) as McpRpcRequest).params?.name === 'upwork__find_jobs'
      ) {
        return {
          ok: true,
          headers: new Headers(),
          text: async () =>
            JSON.stringify({
              jsonrpc: '2.0',
              id: 3,
              error: {
                code: -32603,
                message: 'limit cannot exceed 10',
              },
            }),
        };
      }

      return {
        ok: true,
        headers: new Headers(),
        text: async () => JSON.stringify({}),
      };
    }) as unknown as typeof fetch;

    const client = new UpworkMcpClient('test-token', 'https://mcp.upwork.com/mcp');
    await expect(client.searchJobs('Amazon design')).rejects.toThrow('limit cannot exceed 10');
  });

  it('uses session protocol and passes correct parameters in getJobDetails', async () => {
    let capturedHeaders: Record<string, string> | undefined = undefined;
    let capturedBody: McpRpcRequest | null = null;

    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.body && (JSON.parse(init.body as string) as McpRpcRequest).method === 'initialize') {
        return {
          ok: true,
          headers: new Headers({ 'mcp-session-id': 'session-xyz-789' }),
          text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }),
        };
      }

      if (
        init?.body &&
        (JSON.parse(init.body as string) as McpRpcRequest).params?.name === 'upwork__list_accounts'
      ) {
        return {
          ok: true,
          headers: new Headers(),
          text: async () =>
            JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              result: {
                content: [
                  {
                    text: JSON.stringify({
                      accounts: [{ role: 'TALENT', name: 'Farid Malik', org_uid: 'org_456' }],
                    }),
                  },
                ],
              },
            }),
        };
      }

      if (
        init?.body &&
        (JSON.parse(init.body as string) as McpRpcRequest).params?.name === 'upwork__get_job_details'
      ) {
        capturedHeaders = init?.headers as Record<string, string>;
        capturedBody = JSON.parse(init.body as string) as McpRpcRequest;
        return {
          ok: true,
          headers: new Headers(),
          text: async () =>
            JSON.stringify({
              jsonrpc: '2.0',
              id: 3,
              result: {
                content: [
                  {
                    text: JSON.stringify({
                      id: 'upwork_job_999',
                      title: 'Detailed Amazon Listing Design',
                      description: 'Full product photography and listing creation.',
                      budget_type: 'FIXED',
                      budget_fixed: 500,
                    }),
                  },
                ],
              },
            }),
        };
      }

      return {
        ok: true,
        headers: new Headers(),
        text: async () => JSON.stringify({}),
      };
    }) as unknown as typeof fetch;

    const client = new UpworkMcpClient('test-token', 'https://mcp.upwork.com/mcp', 'Farid Malik');
    const details = await client.getJobDetails('upwork_job_999');

    expect(capturedHeaders).toBeDefined();
    expect(capturedHeaders?.['mcp-session-id']).toBe('session-xyz-789');
    expect(capturedHeaders?.['Authorization']).toBe('Bearer test-token');
    expect(capturedBody?.params?.name).toBe('upwork__get_job_details');
    expect(capturedBody?.params?.arguments?.org_uid).toBe('org_456');
    expect(capturedBody?.params?.arguments?.params?.job_id).toBe('upwork_job_999');
    expect(details?.title).toBe('Detailed Amazon Listing Design');
    expect(details?.budget_fixed).toBe(500);
  });
});
