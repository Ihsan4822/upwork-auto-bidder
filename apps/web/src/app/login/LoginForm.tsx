'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginFormContent() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SENT'>('IDLE');
  const [demoLoading, setDemoLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null,
  );

  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'link_invalid_or_expired') {
      setFeedback({
        type: 'error',
        text: 'This magic sign-in link is invalid or has expired. Please request a fresh link below.',
      });
    } else if (err === 'session_expired') {
      setFeedback({
        type: 'error',
        text: 'Your session has expired. Please sign in again.',
      });
    } else if (err) {
      setFeedback({
        type: 'error',
        text: 'Authentication error. Please try requesting a new link.',
      });
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setFeedback({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setStatus('LOADING');
    setFeedback(null);

    try {
      const res = await fetch('/api/auth/login/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          next: nextParam || undefined,
        }),
      });

      let data: { error?: string; message?: string } | null = null;
      try {
        data = (await res.json()) as { error?: string; message?: string };
      } catch {
        // Fallback if not JSON
      }

      if (!res.ok) {
        setStatus('IDLE');
        setFeedback({
          type: 'error',
          text:
            data?.error ||
            data?.message ||
            `Failed to send sign in link (Status ${res.status}). Please try again.`,
        });
        return;
      }

      setStatus('SENT');
      setFeedback({
        type: 'success',
        text: data?.message || 'If this email can sign in, a sign in link is on its way.',
      });
    } catch (err: unknown) {
      setStatus('IDLE');
      setFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'A network error occurred while requesting the sign in link. Please try again.',
      });
    }
  }

  async function handleDemo() {
    setDemoLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFeedback({
          type: 'error',
          text: data?.error || 'Could not start the demo. Please try again.',
        });
        setDemoLoading(false);
        return;
      }
      window.location.href = '/';
    } catch (err: unknown) {
      setDemoLoading(false);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not start the demo. Please try again.',
      });
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg border border-slate-200 shadow-sm">
        <div className="text-center">
          <span className="bg-emerald-600 text-white font-bold px-3 py-1 rounded text-sm tracking-wide">
            UAB
          </span>
          <h2 className="mt-4 text-2xl font-bold text-slate-900 tracking-tight">
            Sign in to Upwork Proposal Assistant
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Passwordless magic link login. Enter your authorized email to receive a secure sign-in
            link.
          </p>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-md text-sm border ${
              feedback.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={handleDemo}
            disabled={demoLoading}
            className="w-full flex justify-center py-2.5 px-4 border border-emerald-600 rounded-md shadow-sm text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
          >
            {demoLoading ? 'Starting demo...' : 'Try the demo, no account needed'}
          </button>
          <p className="mt-2 text-xs text-slate-500 text-center">
            Explore with sample jobs, scores, and drafts. Demo data only, nothing real is touched.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex-1 border-t border-slate-200" />
          <span>or sign in with a magic link</span>
          <span className="flex-1 border-t border-slate-200" />
        </div>

        {status === 'SENT' ? (
          <div className="text-center space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Check your inbox. If your email is on the authorized allowlist, you will find your
              single-use sign-in link.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatus('IDLE');
                setEmail('');
                setFeedback(null);
              }}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-medium underline"
            >
              Use a different email address
            </button>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email-address"
                className="block text-xs font-semibold uppercase text-slate-700 tracking-wider"
              >
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={status === 'LOADING'}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
              >
                {status === 'LOADING' ? 'Sending link...' : 'Send Magic Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center">Loading...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
