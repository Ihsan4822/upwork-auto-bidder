'use client';

import React, { useState, useEffect } from 'react';
import { getPlainLanguageConsentText, ALLOWED_OAUTH_SCOPES } from '@upwork-bidder/core';

interface ConnectionState {
  status: 'CONNECTED' | 'DISCONNECTED' | 'SCOPE_CHANGED' | 'LOADING' | 'UNKNOWN';
  lastConnectedAt?: string | null;
  scopesGranted?: string[];
  warningMessage?: string;
  registeredAppName: string;
}

export default function UpworkConnectionPage() {
  const consent = getPlainLanguageConsentText();
  const [connection, setConnection] = useState<ConnectionState>({
    status: 'LOADING',
    registeredAppName: 'Upwork Proposal Assistant (Farid Malik)',
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Load current connection status from server API
  useEffect(() => {
    fetchStatus();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
      const success = params.get('success');
      if (err) {
        setFeedbackMessage({ type: 'error', text: decodeURIComponent(err) });
      } else if (success) {
        setFeedbackMessage({
          type: 'success',
          text: 'Upwork MCP connected successfully via OAuth 2.1 (Read-Only)!',
        });
      }
    }
  }, []);

  async function fetchStatus() {
    const controller = new AbortController();
    // Raised to 10 seconds to accommodate slow server cold starts
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch('/api/auth/upwork/status', {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        setConnection(data);
      } else {
        // Show unknown state instead of a wrong DISCONNECTED on slow cold starts or errors
        setConnection((prev) => ({ ...prev, status: 'UNKNOWN' }));
      }
    } catch {
      // Abort or network failure: show unknown state
      setConnection((prev) => ({ ...prev, status: 'UNKNOWN' }));
    }
  }

  async function handleConnect() {
    setActionLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch('/api/auth/upwork/connect', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.authorizationUrl) {
        // Redirect to Upwork OAuth 2.1 via MCP route
        window.location.href = data.authorizationUrl;
      } else {
        setFeedbackMessage({
          type: 'error',
          text: data.error || 'Failed to initiate Upwork OAuth connection',
        });
        setActionLoading(false);
      }
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Network error during connection',
      });
      setActionLoading(false);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        'Are you sure you want to disconnect? Stored OAuth tokens will be permanently deleted from the database.',
      )
    ) {
      return;
    }

    setActionLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch('/api/auth/upwork/disconnect', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMessage({
          type: 'success',
          text: 'Upwork disconnected. Stored tokens deleted.',
        });
        await fetchStatus();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: data.error || 'Failed to disconnect Upwork account',
        });
      }
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Network error during disconnect',
      });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Upwork MCP Connection (Module 1)</h2>
        <p className="text-sm text-slate-600 mt-1">
          OAuth 2.1 authentication with PKCE for Upwork MCP access. Grants strictly read-only job
          discovery permissions.
        </p>
      </div>

      {feedbackMessage && (
        <div
          className={`p-4 rounded-md text-sm border ${
            feedbackMessage.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {feedbackMessage.text}
        </div>
      )}

      {/* Connection Status Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">
                Connection Status:
              </span>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                  connection.status === 'CONNECTED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : connection.status === 'SCOPE_CHANGED'
                      ? 'bg-amber-100 text-amber-800'
                      : connection.status === 'UNKNOWN'
                        ? 'bg-slate-200 text-slate-700'
                        : connection.status === 'LOADING'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-600'
                }`}
              >
                {connection.status === 'UNKNOWN'
                  ? 'Unknown (Cold Start / Retry)'
                  : connection.status}
              </span>
            </div>

            <p className="text-sm font-semibold text-slate-900 mt-2">
              Registered App: {connection.registeredAppName}
            </p>

            {connection.lastConnectedAt && (
              <p className="text-xs text-slate-400 mt-1">
                Last connected: {new Date(connection.lastConnectedAt).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {connection.status === 'UNKNOWN' && (
              <button
                type="button"
                onClick={fetchStatus}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded border border-slate-300 transition-colors"
              >
                Retry Status Check
              </button>
            )}

            {connection.status === 'CONNECTED' ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Disconnecting...' : 'Disconnect Upwork (Delete Token)'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={actionLoading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Connecting...' : 'Connect Upwork via MCP →'}
              </button>
            )}
          </div>
        </div>

        {/* Warning if scope changed */}
        {connection.status === 'SCOPE_CHANGED' && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-sm">
            <strong>Warning (Section 3, Rule 5):</strong> Upwork returned scopes that differ from
            your approved read-only scope list. All automated monitoring has been stopped. Please
            disconnect and re-verify your permissions before reconnecting.
          </div>
        )}
      </div>

      {/* Mandatory Plain-Language Consent Panel (Section 3, Rule 4) */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Permission Boundary &amp; Consent Transparency
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            As required by Section 2 and Section 3 of the project brief, this tool strictly limits
            permissions to read-only discovery.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* What App Can Do */}
          <div className="bg-white p-4 rounded-md border border-slate-200">
            <h4 className="text-xs uppercase font-bold text-emerald-700 tracking-wider flex items-center space-x-1.5">
              <span>✓</span>
              <span>What this app CAN do</span>
            </h4>
            <ul className="mt-3 space-y-2 text-xs text-slate-700">
              {consent.canDo.map((item, i) => (
                <li key={i} className="flex items-start space-x-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What App Can NEVER Do */}
          <div className="bg-white p-4 rounded-md border border-slate-200">
            <h4 className="text-xs uppercase font-bold text-red-600 tracking-wider flex items-center space-x-1.5">
              <span>✕</span>
              <span>What this app CAN NEVER do</span>
            </h4>
            <ul className="mt-3 space-y-2 text-xs text-slate-700">
              {consent.cannotDo.map((item, i) => (
                <li key={i} className="flex items-start space-x-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Section 3, Rule 1 Notice */}
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-md">
          <p className="text-xs font-semibold text-amber-900">
            5 November 2026 OAuth Lesson Acceptance Rule (Section 3, Rule 1):
          </p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            The application name shown on the Upwork authorization screen must match your registered
            product. If any unrecognized app name appears, or if write/messaging/proposal
            permissions are requested, <strong>do not authorize</strong>. Cancel immediately and
            report it.
          </p>
        </div>

        {/* Allowed Scopes Table */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Approved Read-Only Scopes ({ALLOWED_OAUTH_SCOPES.length})
          </h4>
          <div className="bg-white rounded border border-slate-200 overflow-x-auto text-xs">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Scope</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="px-3 py-2 font-mono font-medium text-slate-800">jobs:read</td>
                  <td className="px-3 py-2 text-emerald-700 font-semibold">Read Only</td>
                  <td className="px-3 py-2 text-slate-600">
                    Scan marketplace listings for saved searches
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono font-medium text-slate-800">profile:read</td>
                  <td className="px-3 py-2 text-emerald-700 font-semibold">Read Only</td>
                  <td className="px-3 py-2 text-slate-600">
                    Match jobs to Farid Malik&apos;s Amazon design services
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
