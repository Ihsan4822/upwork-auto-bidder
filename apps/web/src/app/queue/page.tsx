'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface QueueJob {
  id: string;
  upworkJobId: string;
  title: string | null;
  budgetType: string | null;
  budgetAmountFixed: number | null;
  hourlyRateMin: number | null;
  hourlyRateMax: number | null;
  clientCountry: string | null;
  status: string;
  scores: Array<{ label: string; score: number; reasons: string[] }>;
  drafts: Array<{
    id: string;
    version: number;
    draftText: string;
    wordCount: number | null;
    status: string;
    portfolioItem: { title: string; link: string } | null;
  }>;
}

export default function ReviewQueuePage() {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/queue/jobs?status=${activeTab}`)
      .then((res) => res.json())
      .then((data) => {
        setJobs(data.jobs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Proposal Review Queue (Module 6)</h2>
          <p className="text-sm text-slate-600 mt-1">
            Human-in-the-loop review. Inspect AI drafts, edit versions, approve, and mark submitted manually.
          </p>
        </div>
        <div className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full font-medium">
          {jobs.length} jobs in queue
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-semibold">
        {['ALL', 'DRAFT_READY', 'IN_REVIEW', 'APPROVED', 'SUBMITTED_MANUALLY', 'SKIPPED'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
          Loading proposals in queue...
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
          No proposals found for status &quot;{activeTab.replace('_', ' ')}&quot;.
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const score = job.scores[0];
            const draft = job.drafts[0];

            return (
              <div
                key={job.id}
                className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                          job.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : job.status === 'SUBMITTED_MANUALLY'
                            ? 'bg-blue-100 text-blue-800'
                            : job.status === 'DRAFT_READY'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {job.status.replace('_', ' ')}
                      </span>

                      {score && (
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          Score: {score.score}/100 ({score.label})
                        </span>
                      )}

                      {draft && (
                        <span className="text-xs text-slate-500">
                          Draft v{draft.version} (~{draft.wordCount || 200} words)
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 mt-2">
                      {job.title || 'Untitled Job'}
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      ID: {job.upworkJobId} · {job.clientCountry || 'Unknown Country'} · Budget:{' '}
                      {job.budgetType === 'FIXED'
                        ? `$${job.budgetAmountFixed}`
                        : `$${job.hourlyRateMin ?? '?'}-$${job.hourlyRateMax ?? '?'}/hr`}
                    </p>
                  </div>

                  <Link
                    href={`/queue/${job.id}`}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-sm transition-colors whitespace-nowrap"
                  >
                    Review Proposal →
                  </Link>
                </div>

                {draft && (
                  <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-3 rounded border border-slate-100 font-mono">
                    {draft.draftText}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
