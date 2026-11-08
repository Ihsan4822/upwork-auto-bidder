'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface ScoredJobItem {
  id: string;
  label: 'APPLY' | 'APPLY_PLUS_BOOST' | 'SKIP';
  score: number;
  reasons: string[];
  modelName: string;
  createdAt: string;
  job: {
    upworkJobId: string;
    title: string | null;
    description: string | null;
    budgetType: string | null;
    budgetAmountFixed: number | null;
    hourlyRateMin: number | null;
    hourlyRateMax: number | null;
    clientCountry: string | null;
    clientTotalSpend: number | null;
    clientHireRate: number | null;
    paymentVerified: boolean | null;
    proposalCount: number | null;
    jobUrl: string | null;
    status: string;
  };
}

export default function ScoredJobsPage() {
  const [scores, setScores] = useState<ScoredJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScoredJobs();
  }, []);

  async function fetchScoredJobs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jobs/scored');
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed to load scored jobs (Status ${res.status})`);
      }
      const data = await res.json();
      setScores(data.scores || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load scored jobs. Please check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Scored Jobs (Module 3)</h2>
          <p className="text-sm text-slate-600 mt-1">
            Jobs that passed hard filters and were evaluated by AI for niche fit, client quality,
            and timing.
          </p>
        </div>
        {!error && (
          <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full font-medium">
            {scores.length} jobs evaluated
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-center space-y-3">
          <p className="text-sm font-semibold text-red-800">{error}</p>
          <button
            type="button"
            onClick={fetchScoredJobs}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded shadow-sm transition-colors"
          >
            Retry Loading Scored Jobs
          </button>
        </div>
      )}

      {loading && !error ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
          Loading scored jobs...
        </div>
      ) : !loading && !error && scores.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
          No jobs scored yet.
        </div>
      ) : (
        !loading &&
        !error && (
          <div className="space-y-5">
            {scores.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-1 rounded font-bold tracking-wide uppercase ${
                          item.label === 'APPLY_PLUS_BOOST'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : item.label === 'APPLY'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {item.label === 'APPLY_PLUS_BOOST'
                          ? '★ APPLY + BOOST'
                          : item.label === 'APPLY'
                            ? '✓ APPLY'
                            : '✕ SKIP'}
                      </span>
                      <span className="text-sm font-bold text-slate-700">
                        Score: {item.score}/100
                      </span>
                      <span className="text-xs text-slate-400">({item.modelName})</span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-900">
                      {item.job.title || 'Untitled Job'}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>ID: {item.job.upworkJobId}</span>
                      <span>•</span>
                      <span>{item.job.clientCountry || 'Country Not Available'}</span>
                      <span>•</span>
                      <span>
                        Spend:{' '}
                        {item.job.clientTotalSpend !== null
                          ? `$${item.job.clientTotalSpend}`
                          : 'Not Available'}
                      </span>
                      <span>•</span>
                      <span>
                        Hire Rate:{' '}
                        {item.job.clientHireRate !== null
                          ? `${(item.job.clientHireRate * 100).toFixed(0)}%`
                          : 'Not Available'}
                      </span>
                      <span>•</span>
                      <span>
                        Proposals:{' '}
                        {item.job.proposalCount !== null ? item.job.proposalCount : 'Not Available'}
                      </span>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0">
                    {item.job.jobUrl && (
                      <a
                        href={item.job.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-700 font-medium hover:underline block"
                      >
                        Open on Upwork ↗
                      </a>
                    )}
                    {item.label !== 'SKIP' && (
                      <Link
                        href="/queue"
                        className="inline-block mt-2 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded transition-colors"
                      >
                        View in Queue →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Reasons List */}
                <div className="bg-slate-50 rounded-md p-4 border border-slate-100">
                  <p className="text-xs font-bold uppercase text-slate-600 tracking-wider mb-2">
                    AI Scoring Reasons ({item.reasons.length}):
                  </p>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {item.reasons.map((reason, i) => (
                      <li key={i} className="flex items-start space-x-2">
                        <span className="text-slate-400 font-bold">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
