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

  useEffect(() => {
    fetch('/api/jobs/filtered')
      .then((res) => res.json())
      .then((data) => {
        setJobs(data.jobs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Filtered Out Jobs (Module 2 Audit)</h2>
          <p className="text-sm text-slate-600 mt-1">
            Jobs rejected by Section 5 hard filters before any AI scoring. Never silently deleted.
          </p>
        </div>
        <span className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full font-medium">
          {jobs.length} jobs filtered
        </span>
      </div>

      {/* Audit Banner */}
      <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 text-xs text-slate-700 flex items-center justify-between">
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

      {loading ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
          Loading filtered jobs audit...
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
          No jobs have been filtered out yet.
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 leading-snug">
                    {job.title || 'Untitled Job'}
                  </h3>
                  <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
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

                <div className="text-right">
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
      )}
    </div>
  );
}
