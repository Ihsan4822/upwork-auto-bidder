'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface AnalyticsSummary {
  totalJobs: number;
  filteredOutCount: number;
  scoredCount: number;
  draftedCount: number;
  approvedCount: number;
  submittedManuallyCount: number;
  connectsSpentTotal: number;
  totalWithViewTracked: number;
  totalWithReplyTracked: number;
  viewCount: number;
  replyCount: number;
  viewRateDisplay: string;
  replyRateDisplay: string;
  appConnectsSpent: 0;
}

interface SubmittedJobItem {
  id: string;
  upworkJobId: string;
  title: string | null;
  status: string;
  jobUrl: string | null;
  analyticsEntry: {
    connectsSpent: number | null;
    clientViewed: boolean | null;
    clientReplied: boolean | null;
    notes: string | null;
  } | null;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [submittedJobs, setSubmittedJobs] = useState<SubmittedJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [formInputs, setFormInputs] = useState<
    Record<string, { connects: number; viewed: boolean; replied: boolean; notes: string }>
  >({});
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      setSummary(data.summary);
      setSubmittedJobs(data.submittedJobs || []);

      // Initialize form inputs
      const initial: Record<
        string,
        { connects: number; viewed: boolean; replied: boolean; notes: string }
      > = {};
      for (const j of data.submittedJobs || []) {
        initial[j.id] = {
          connects: j.analyticsEntry?.connectsSpent ?? 0,
          viewed: j.analyticsEntry?.clientViewed === true,
          replied: j.analyticsEntry?.clientReplied === true,
          notes: j.analyticsEntry?.notes ?? '',
        };
      }
      setFormInputs(initial);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  async function handleSaveTracking(jobId: string) {
    setSavingJobId(jobId);
    setAlertMsg(null);
    const input = formInputs[jobId];
    if (!input) return;

    try {
      const res = await fetch('/api/analytics/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          connectsSpent: Number(input.connects),
          clientViewed: Boolean(input.viewed),
          clientReplied: Boolean(input.replied),
          notes: input.notes,
        }),
      });

      if (res.ok) {
        setAlertMsg('Manual tracking entry updated successfully!');
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingJobId(null);
    }
  }

  function handleInputChange(jobId: string, field: string, value: unknown) {
    setFormInputs((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        [field]: value,
      },
    }));
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Basic Analytics (Module 7)</h2>
        <p className="text-sm text-slate-600 mt-1">
          Honest metrics tracking. View and reply rates are calculated ONLY from data you enter
          manually. The app itself spends zero Connects.
        </p>
      </div>

      {alertMsg && (
        <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          {alertMsg}
        </div>
      )}

      {/* Funnel Pipeline Grid */}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Found
              </span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalJobs}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-center">
              <span className="text-[11px] font-bold text-red-500 uppercase tracking-wider">
                Filtered
              </span>
              <p className="text-2xl font-bold text-red-700 mt-1">{summary.filteredOutCount}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-center">
              <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
                Scored
              </span>
              <p className="text-2xl font-bold text-purple-900 mt-1">{summary.scoredCount}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-center">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                Drafted
              </span>
              <p className="text-2xl font-bold text-amber-900 mt-1">{summary.draftedCount}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-center">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                Approved
              </span>
              <p className="text-2xl font-bold text-emerald-900 mt-1">{summary.approvedCount}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-center">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                Submitted
              </span>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {summary.submittedManuallyCount}
              </p>
            </div>
          </div>

          {/* Key Rates Card */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Client View Rate
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {summary.viewRateDisplay}
              </p>
              <span className="text-xs text-slate-400 mt-1 block">
                {summary.totalWithViewTracked > 0
                  ? `${summary.viewCount} viewed of ${summary.totalWithViewTracked} tracked`
                  : 'Requires manual view entries'}
              </span>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Client Reply Rate
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {summary.replyRateDisplay}
              </p>
              <span className="text-xs text-slate-400 mt-1 block">
                {summary.totalWithReplyTracked > 0
                  ? `${summary.replyCount} replied of ${summary.totalWithReplyTracked} tracked`
                  : 'Requires manual reply entries'}
              </span>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Connects Spent (Farid)
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {summary.connectsSpentTotal}
              </p>
              <span className="text-xs text-slate-400 mt-1 block">
                Sum of your manual submissions
              </span>
            </div>

            <div className="bg-emerald-50 p-5 rounded-lg border border-emerald-200 shadow-sm">
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                Connects Spent (App)
              </p>
              <p className="text-3xl font-extrabold text-emerald-950 mt-2">0</p>
              <span className="text-xs text-emerald-700 mt-1 block font-medium">
                Guaranteed by Safe Model ban
              </span>
            </div>
          </div>
        </>
      )}

      {/* Manual Entry Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Manual Submission Tracker</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            After submitting proposals manually on Upwork, record your Connects spent and whether
            the client viewed or replied below.
          </p>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500">Loading submitted jobs...</p>
        ) : submittedJobs.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500 bg-slate-50 rounded">
            No proposals have been approved or marked submitted yet.
            <div className="mt-2">
              <Link href="/queue" className="text-emerald-700 font-semibold hover:underline">
                Go to Review Queue →
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Job</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Connects Spent</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-500">Viewed?</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-500">Replied?</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Notes</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submittedJobs.map((job) => {
                  const input = formInputs[job.id] || {
                    connects: 0,
                    viewed: false,
                    replied: false,
                    notes: '',
                  };

                  return (
                    <tr key={job.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-3 max-w-xs">
                        <p className="font-semibold text-slate-900 truncate">
                          {job.title || 'Untitled'}
                        </p>
                        <p className="text-slate-400 text-[10px]">ID: {job.upworkJobId}</p>
                      </td>

                      <td className="px-3 py-3 w-32">
                        <input
                          type="number"
                          min="0"
                          value={input.connects}
                          onChange={(e) =>
                            handleInputChange(job.id, 'connects', parseInt(e.target.value) || 0)
                          }
                          className="w-20 border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                        />
                      </td>

                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={input.viewed}
                          onChange={(e) => handleInputChange(job.id, 'viewed', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                        />
                      </td>

                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={input.replied}
                          onChange={(e) => handleInputChange(job.id, 'replied', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                        />
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={input.notes}
                          onChange={(e) => handleInputChange(job.id, 'notes', e.target.value)}
                          placeholder="e.g. Client requested call"
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-800"
                        />
                      </td>

                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSaveTracking(job.id)}
                          disabled={savingJobId === job.id}
                          className="px-3 py-1 bg-slate-900 hover:bg-black text-white text-[11px] font-semibold rounded transition-colors"
                        >
                          {savingJobId === job.id ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
