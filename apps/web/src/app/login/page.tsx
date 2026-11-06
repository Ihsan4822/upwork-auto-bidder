'use client';

import React, { useState, useEffect } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SENT'>('IDLE');
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
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
    }
  }, []);

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
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      setStatus('SENT');
      setFeedback({
        type: 'success',
        text: data.message || 'If this email can sign in, a sign in link is on its way.',
      });
    } catch {
      setStatus('SENT');
      setFeedback({
        type: 'success',
        text: 'If this email can sign in, a sign in link is on its way.',
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
