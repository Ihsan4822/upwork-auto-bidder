/**
 * mcp-allowlist.ts — The ONLY MCP tools this app is permitted to call.
 *
 * WHY THIS FILE IS CRITICAL:
 * The official Upwork MCP server exposes tools that include proposal submission,
 * messaging, contract management, and other write operations — ALL BANNED by
 * Section 2 of the brief. This allowlist is the enforcement layer.
 *
 * HOW IT WORKS:
 * The MCP adapter checks this list before making ANY tool call. If the tool
 * name is not in ALLOWED_MCP_TOOLS, the call throws BannedMcpToolError and
 * is never sent to the server.
 *
 * HOW TO ADD A TOOL (requires human approval, never automated):
 * 1. Confirm the tool is read-only
 * 2. Add it to ALLOWED_MCP_TOOLS with a reason comment
 * 3. The scope guard test will verify it is not in BANNED_MCP_TOOL_PATTERNS
 * 4. Add a decision entry in docs/DECISIONS.md
 * 5. Run: pnpm guard:scopes
 *
 * NEVER add any tool matching BANNED_MCP_TOOL_PATTERNS to the allowlist.
 */

/**
 * Exact tool names (or name prefixes) that this app is allowed to call.
 * All are read-only job search tools.
 */
export const ALLOWED_MCP_TOOLS = [
  'search_jobs',
  'find_jobs',
  'list_jobs',
  'get_job',
  'get_job_details',
] as const;

export type AllowedMcpTool = (typeof ALLOWED_MCP_TOOLS)[number];

/**
 * Patterns that must NEVER appear in any allowed tool name.
 * The scope guard test fails the build if any allowed tool matches these.
 *
 * These map to the banned access types in Section 2 of the brief.
 */
export const BANNED_MCP_TOOL_PATTERNS = [
  'submit',
  'send',
  'message',
  'contract',
  'offer',
  'payment',
  'hire',
  'invite',
  'profile_write',
  'edit_profile',
  'timesheet',
  'write',
  'create',
  'update',
  'delete',
  'post_job',
  'publish',
] as const;

/**
 * Error thrown when the MCP adapter is asked to call a banned tool.
 * This is a hard stop — it must never be caught and ignored.
 */
export class BannedMcpToolError extends Error {
  constructor(toolName: string) {
    super(
      `SECURITY: Attempted to call banned MCP tool "${toolName}". ` +
        `This tool is not in the ALLOWED_MCP_TOOLS list. ` +
        `See packages/ai/src/mcp-allowlist.ts and Section 2 of the brief.`,
    );
    this.name = 'BannedMcpToolError';
  }
}

/**
 * Returns true if the given tool name is in the allowed list.
 *
 * @param toolName - The MCP tool name to check
 * @returns true if the tool is allowed, false if banned
 */
export function isMcpToolAllowed(toolName: string): boolean {
  return (ALLOWED_MCP_TOOLS as readonly string[]).includes(toolName);
}

/**
 * Asserts that the given tool name is allowed, throwing BannedMcpToolError if not.
 * Call this before every MCP tool call.
 *
 * @param toolName - The MCP tool name to check
 * @throws BannedMcpToolError if the tool is not in the allowlist
 */
export function assertMcpToolAllowed(toolName: string): void {
  if (!isMcpToolAllowed(toolName)) {
    throw new BannedMcpToolError(toolName);
  }
}
