/**
 * scope-guard.test.ts — CRITICAL SECURITY TEST
 *
 * This test MUST pass before any deployment.
 * It verifies that the MCP allowlist contains only read-only job tools
 * and that no banned tool patterns have been accidentally added.
 *
 * Section 3, Rule 3 of the brief:
 * "Build an automated test that fails the build if any write scope,
 * submit scope, message scope, contract scope, offer scope, or payment
 * scope appears in the OAuth configuration."
 *
 * Section D4 of the brief:
 * "A test that fails if any banned OAuth scope appears."
 *
 * HOW TO RUN:
 *   pnpm guard:scopes
 *   (Also runs as part of pnpm test)
 *
 * IF THIS TEST FAILS:
 * Stop. Do not suppress the failure. Do not comment out the assertion.
 * Remove the banned tool from the allowlist and report to Farid.
 */

import { describe, it, expect } from 'vitest';
import {
  ALLOWED_MCP_TOOLS,
  BANNED_MCP_TOOL_PATTERNS,
  isMcpToolAllowed,
  assertMcpToolAllowed,
  BannedMcpToolError,
} from '../src/mcp-allowlist';

describe('MCP Scope Guard — CRITICAL SECURITY TEST', () => {
  describe('Allowlist integrity', () => {
    it('allowlist must not be empty', () => {
      expect(ALLOWED_MCP_TOOLS.length).toBeGreaterThan(0);
    });

    it('every tool in the allowlist must be a non-empty string', () => {
      for (const tool of ALLOWED_MCP_TOOLS) {
        expect(typeof tool).toBe('string');
        expect(tool.length).toBeGreaterThan(0);
      }
    });

    it('MUST FAIL if any allowed tool matches a banned pattern', () => {
      // This is the core security assertion.
      // If this test fails, a banned tool has been added to the allowlist.
      for (const tool of ALLOWED_MCP_TOOLS) {
        for (const bannedPattern of BANNED_MCP_TOOL_PATTERNS) {
          const toolLower = tool.toLowerCase();
          const patternLower = bannedPattern.toLowerCase();
          expect(toolLower).not.toContain(patternLower);
          // If this assertion fails: remove the tool from ALLOWED_MCP_TOOLS immediately.
          // Do not suppress this test. See AGENTS.md — Safe Model section.
        }
      }
    });

    it('allowed tools must only be job-search and job-read operations', () => {
      // All allowed tools must relate to searching or reading jobs.
      // This is a human-readable check to catch tools that bypass the pattern check.
      const allowedPrefixes = ['search_', 'find_', 'list_', 'get_'];
      for (const tool of ALLOWED_MCP_TOOLS) {
        const isJobRelated = allowedPrefixes.some((prefix) => tool.startsWith(prefix));
        expect(isJobRelated).toBe(true);
        // If this fails: the tool name does not follow the read-only pattern.
        // Review it against Section 2 of the brief before adding any exception.
      }
    });
  });

  describe('isMcpToolAllowed()', () => {
    it('returns true for all tools in the allowlist', () => {
      for (const tool of ALLOWED_MCP_TOOLS) {
        expect(isMcpToolAllowed(tool)).toBe(true);
      }
    });

    it('returns false for banned tools — submit_proposal', () => {
      expect(isMcpToolAllowed('submit_proposal')).toBe(false);
    });

    it('returns false for banned tools — send_message', () => {
      expect(isMcpToolAllowed('send_message')).toBe(false);
    });

    it('returns false for banned tools — manage_contract', () => {
      expect(isMcpToolAllowed('manage_contract')).toBe(false);
    });

    it('returns false for banned tools — make_offer', () => {
      expect(isMcpToolAllowed('make_offer')).toBe(false);
    });

    it('returns false for banned tools — payment_action', () => {
      expect(isMcpToolAllowed('payment_action')).toBe(false);
    });

    it('returns false for banned tools — hire_freelancer', () => {
      expect(isMcpToolAllowed('hire_freelancer')).toBe(false);
    });

    it('returns false for banned tools — edit_profile', () => {
      expect(isMcpToolAllowed('edit_profile')).toBe(false);
    });

    it('returns false for banned tools — post_job', () => {
      expect(isMcpToolAllowed('post_job')).toBe(false);
    });

    it('returns false for any unknown tool not in the allowlist', () => {
      expect(isMcpToolAllowed('some_new_tool')).toBe(false);
      expect(isMcpToolAllowed('')).toBe(false);
      expect(isMcpToolAllowed('admin_delete_user')).toBe(false);
    });
  });

  describe('assertMcpToolAllowed()', () => {
    it('does not throw for allowed tools', () => {
      for (const tool of ALLOWED_MCP_TOOLS) {
        expect(() => assertMcpToolAllowed(tool)).not.toThrow();
      }
    });

    it('throws BannedMcpToolError for submit_proposal', () => {
      expect(() => assertMcpToolAllowed('submit_proposal')).toThrow(BannedMcpToolError);
    });

    it('throws BannedMcpToolError for send_message', () => {
      expect(() => assertMcpToolAllowed('send_message')).toThrow(BannedMcpToolError);
    });

    it('throws BannedMcpToolError for any unknown tool', () => {
      expect(() => assertMcpToolAllowed('unknown_tool')).toThrow(BannedMcpToolError);
    });

    it('error message names the banned tool', () => {
      try {
        assertMcpToolAllowed('submit_proposal');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(BannedMcpToolError);
        expect((error as Error).message).toContain('submit_proposal');
      }
    });
  });
});
