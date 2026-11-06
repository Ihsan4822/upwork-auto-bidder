'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Stats {
  totalJobs: number;
  filteredOut: number;
  scoredPending: number;
  draftReady: number;
  skipped: number;
  submitted: number;
  totalScored: number;
  applyCount: number;
  boostCount: number;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({
    totalJobs: 0,
    filteredOut: 0,
    scoredPending: 0,
    draftReady: 0,
    skipped: 0,
    submitted: 0,
    totalScored: 0,
    applyCount: 0,
    boostCount: 0,
  });

  useEffect(() => {
    fetch('/api/jobs/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      {/* Safe Model Notification Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start space-x-3">
        <div className="bg-emerald-600 text-white rounded-full p-1 mt-0.5 text-xs font-bold w-5 h-5 flex items-center justify-center">
          ✓
        </div>
        <div>
          <h2 className="text-sm font-semibold text-emerald-900">Safe Model Active</h2>
          <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
            Strict read-only MCP access. Auto-submit, auto-boost, and messaging access are
            completely disabled. All proposals are reviewed and submitted manually by human hands on
            Upwork.
          </p>
        </div>
      </div>

      {/* Main Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs uppercase font-medium text-slate-500 tracking-wider">Jobs Found</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalJobs}</p>
          <span className="text-xs text-slate-400 mt-1 block">Polled via MCP saved searches</span>
        </div>

        <Link
          href="/jobs/filtered"
          className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors block"
        >
          <p className="text-xs uppercase font-medium text-slate-500 tracking-wider">
            Filtered Out
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.filteredOut}</p>
          <span className="text-xs text-red-600 font-medium mt-1 block">View audit reasons →</span>
        </Link>

        <Link
          href="/jobs/scored"
          className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors block"
        >
          <p className="text-xs uppercase font-medium text-slate-500 tracking-wider">
            Scored by AI
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalScored}</p>
          <span className="text-xs text-emerald-600 font-medium mt-1 block">
            {stats.applyCount} Apply · {stats.boostCount} Boost →
          </span>
        </Link>

        <Link
          href="/queue"
          className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors block"
        >
          <p className="text-xs uppercase font-medium text-slate-500 tracking-wider">
            Submitted Manually
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.submitted}</p>
          <span className="text-xs text-slate-400 mt-1 block">Zero Connects spent by app</span>
        </Link>
      </div>

      {/* Navigation Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Module 2: Hard Filters Audit</h3>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Verify rejection reasons in real time. Hard filters block jobs below the $15/hr hourly
            or $100 fixed floor, unverified payment clients, and jobs outside Farid&apos;s Amazon
            niches.
          </p>
          <div className="mt-4">
            <Link
              href="/jobs/filtered"
              className="text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded transition-colors inline-block"
            >
              Inspect Filtered Jobs ({stats.filteredOut}) →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Module 3: AI Scoring Results</h3>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Review Gemini 1.5 Pro evaluations for passing jobs. Every score provides 3 to 5
            structured reasons and honest nulls for unavailable client fields.
          </p>
          <div className="mt-4">
            <Link
              href="/jobs/scored"
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded transition-colors inline-block"
            >
              Inspect Scored Jobs ({stats.totalScored}) →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
