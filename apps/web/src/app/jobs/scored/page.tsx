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

  useEffect(() => {
    fetch('/api/jobs/scored')
      .then((res) => res.json())
      .then((data) => {
        setScores(data.scores || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Scored Jobs (Module 3)</h2>
          <p className="text-sm text-slate-600 mt-1">
            Jobs that passed hard filters and were evaluated by AI for niche fit, client quality,
            and timing.
          </p>
        </div>
        <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full font-medium">
          {scores.length} jobs evaluated
        </span>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
          Loading scored jobs...
        </div>
      ) : scores.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
          No jobs scored yet.
        </div>
      ) : (
        <div className="space-y-5">
          {scores.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2.5">
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

                  <h3 className="text-base font-semibold text-slate-900 mt-2">
                    {item.job.title || 'Untitled Job'}
                  </h3>

                  <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
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

                <div className="text-right">
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
      )}
    </div>
  );
}
