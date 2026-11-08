'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface FilteredJob {
  id: string;
  upworkJobId: string;
  title: string | null;
  description: string | null;
  budgetType: string | null;
  budgetAmountFixed: number | null;
  hourlyRateMin: number | null;
  hourlyRateMax: number | null;
  clientCountry: string | null;
  paymentVerified: boolean | null;
  filterReason: string | null;
  createdAt: string;
  jobUrl: string | null;
}

export default function FilteredJobsPage() {
  const [jobs, setJobs] = useState<FilteredJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFilteredJobs();
  }, []);

  async function fetchFilteredJobs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jobs/filtered');
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed to load filtered jobs (Status ${res.status})`);
      }
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load filtered jobs audit. Please check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Filtered Out Jobs (Module 2 Audit)</h2>
          <p className="text-sm text-slate-600 mt-1">
            Jobs rejected by Section 5 hard filters before any AI scoring. Never silently deleted.
          </p>
        </div>
        {!error && (
          <span className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full font-medium">
            {jobs.length} jobs filtered
          </span>
        )}
      </div>

      {/* Audit Banner */}
      <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
        <div>
          <strong>Active Filter Floors:</strong> Hourly Floor: $15/hr · Fixed Floor: $100 · Payment
          Verified: Required · Niches: Amazon Design Only
        </div>
        <Link
          href="/settings/connection"
          className="text-emerald-700 font-semibold hover:underline"
        >
          View Settings →
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-center space-y-3">
          <p className="text-sm font-semibold text-red-800">{error}</p>
          <button
            type="button"
            onClick={fetchFilteredJobs}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded shadow-sm transition-colors"
          >
            Retry Loading Filtered Jobs
          </button>
        </div>
      )}

      {loading && !error ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
          Loading filtered jobs audit...
        </div>
      ) : !loading && !error && jobs.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
          No jobs have been filtered out yet.
        </div>
      ) : (
        !loading &&
        !error && (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 leading-snug">
                      {job.title || 'Untitled Job'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                      <span>ID: {job.upworkJobId}</span>
                      <span>•</span>
                      <span>{job.clientCountry || 'Country Not Available'}</span>
                      <span>•</span>
                      <span>
                        Budget:{' '}
                        {job.budgetType === 'FIXED'
                          ? job.budgetAmountFixed !== null
                            ? `$${job.budgetAmountFixed}`
                            : 'Not Available'
                          : job.budgetType === 'HOURLY'
                            ? `$${job.hourlyRateMin ?? '?'}-$${job.hourlyRateMax ?? '?'}/hr`
                            : 'Not Available'}
                      </span>
                      <span>•</span>
                      <span>
                        Payment:{' '}
                        {job.paymentVerified === true
                          ? 'Verified'
                          : job.paymentVerified === false
                            ? 'Unverified'
                            : 'Not Available'}
                      </span>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <span className="inline-block bg-red-100 text-red-800 text-xs px-2.5 py-1 rounded font-semibold">
                      ✕ {job.filterReason || 'Filtered Out'}
                    </span>
                    {job.jobUrl && (
                      <a
                        href={job.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-emerald-700 hover:underline mt-1.5"
                      >
                        Open Upwork Post ↗
                      </a>
                    )}
                  </div>
                </div>

                {job.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-3 rounded border border-slate-100">
                    {job.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
