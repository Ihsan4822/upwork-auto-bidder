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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQueueJobs();
  }, [activeTab]);

  async function fetchQueueJobs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/queue/jobs?status=${activeTab}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error || `Failed to load review queue proposals (Status ${res.status})`,
        );
      }
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load proposals from the review queue. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Proposal Review Queue (Module 6)</h2>
          <p className="text-sm text-slate-600 mt-1">
            Human-in-the-loop review. Inspect AI drafts, edit versions, approve, and mark submitted
            manually.
          </p>
        </div>
        {!error && (
          <div className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full font-medium">
            {jobs.length} jobs in queue
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-semibold">
        {['ALL', 'DRAFT_READY', 'IN_REVIEW', 'APPROVED', 'SUBMITTED_MANUALLY', 'SKIPPED'].map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ),
        )}
      </div>

      {/* Error state with retry */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-center space-y-3">
          <p className="text-sm font-semibold text-red-800">{error}</p>
          <button
            type="button"
            onClick={fetchQueueJobs}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded shadow-sm transition-colors"
          >
            Retry Loading Queue
          </button>
        </div>
      )}

      {loading && !error ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
          Loading proposals in queue...
        </div>
      ) : !loading && !error && jobs.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
          No proposals found for status &quot;{activeTab.replace('_', ' ')}&quot;.
        </div>
      ) : (
        !loading &&
        !error && (
          <div className="space-y-4">
            {jobs.map((job) => {
              const score = job.scores[0];
              const draft = job.drafts[0];

              return (
                <div
                  key={job.id}
                  className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
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

                      <h3 className="text-base font-semibold text-slate-900">
                        {job.title || 'Untitled Job'}
                      </h3>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>ID: {job.upworkJobId}</span>
                        <span>·</span>
                        <span>{job.clientCountry || 'Unknown Country'}</span>
                        <span>·</span>
                        <span>
                          Budget:{' '}
                          {job.budgetType === 'FIXED'
                            ? `$${job.budgetAmountFixed}`
                            : `$${job.hourlyRateMin ?? '?'}-$${job.hourlyRateMax ?? '?'}/hr`}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Link
                        href={`/queue/${job.id}`}
                        className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-sm transition-colors whitespace-nowrap"
                      >
                        Review Proposal →
                      </Link>
                    </div>
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
        )
      )}
    </div>
  );
}
