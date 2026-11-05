'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface SingleJobData {
  id: string;
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
  scores: Array<{
    label: string;
    score: number;
    reasons: string[];
    modelName: string;
  }>;
  drafts: Array<{
    id: string;
    version: number;
    draftText: string;
    wordCount: number | null;
    status: string;
    portfolioItemId: string | null;
    portfolioItem: { id: string; title: string; link: string } | null;
    createdAt: string;
  }>;
  reviewActions: Array<{
    id: string;
    action: string;
    actorId: string;
    note: string | null;
    createdAt: string;
  }>;
}

interface PortfolioItem {
  id: string;
  title: string;
  link: string;
  nicheTags: string[];
}

export default function SingleJobReviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const [job, setJob] = useState<SingleJobData | null>(null);
  const [portfolioList, setPortfolioList] = useState<PortfolioItem[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [editableText, setEditableText] = useState<string>('');
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  async function fetchJob() {
    try {
      const res = await fetch(`/api/queue/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data.job);
        setPortfolioList(data.portfolioItems || []);

        const latestDraft = data.job.drafts[0];
        if (latestDraft) {
          setSelectedVersion(latestDraft.version);
          setEditableText(latestDraft.draftText);
          setSelectedPortfolioId(latestDraft.portfolioItemId || '');
        }
      }
    } catch (err) {
      console.error('Failed to load job details', err);
    }
  }

  function handleVersionChange(versionNum: number) {
    if (!job) return;
    const targetDraft = job.drafts.find((d) => d.version === versionNum);
    if (targetDraft) {
      setSelectedVersion(versionNum);
      setEditableText(targetDraft.draftText);
      setSelectedPortfolioId(targetDraft.portfolioItemId || '');
    }
  }

  async function executeAction(actionType: string) {
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/queue/jobs/${jobId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          draftText: editableText,
          portfolioItemId: selectedPortfolioId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (actionType === 'SAVE_DRAFT_VERSION') {
          setMessage(`Saved new draft version ${data.draft.version}!`);
        } else if (actionType === 'APPROVE') {
          setMessage('Proposal approved! You can now copy and submit manually on Upwork.');
        } else if (actionType === 'MARK_SUBMITTED') {
          setMessage('Marked as submitted manually! Logged in analytics.');
        } else if (actionType === 'SKIP') {
          setMessage('Job skipped.');
        }
        await fetchJob();
      } else {
        setMessage(`Error: ${data.error || 'Action failed'}`);
      }
    } catch (err: unknown) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function copyProposalToClipboard() {
    navigator.clipboard.writeText(editableText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (!job) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading proposal review...</div>;
  }

  const score = job.scores[0];
  const wordCount = editableText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/queue" className="text-xs font-semibold text-emerald-700 hover:underline">
          ← Back to Review Queue
        </Link>
        <span
          className={`text-xs px-2.5 py-1 rounded font-bold uppercase ${
            job.status === 'APPROVED'
              ? 'bg-emerald-100 text-emerald-800'
              : job.status === 'SUBMITTED_MANUALLY'
              ? 'bg-blue-100 text-blue-800'
              : job.status === 'DRAFT_READY'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          Status: {job.status.replace('_', ' ')}
        </span>
      </div>

      {message && (
        <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          {message}
        </div>
      )}

      {/* APPROVED BANNER & MANUAL SUBMIT ACTION */}
      {job.status === 'APPROVED' && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-emerald-950 flex items-center space-x-2">
                <span>✓</span>
                <span>Approved For Manual Submit (Human Gate)</span>
              </h3>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                Copy your approved draft below, open Upwork in your browser, and submit with your own hands.
                Then click &quot;Mark as Submitted Manually&quot; to log the timestamp in analytics.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={copyProposalToClipboard}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded shadow transition-colors"
              >
                {copied ? '✓ Copied to Clipboard!' : 'Copy Proposal Text'}
              </button>

              {job.jobUrl && (
                <a
                  href={job.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-white border border-emerald-600 text-emerald-800 hover:bg-emerald-100 text-xs font-bold rounded shadow-sm transition-colors"
                >
                  Open Upwork Listing ↗
                </a>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-emerald-200 flex justify-end">
            <button
              type="button"
              onClick={() => executeAction('MARK_SUBMITTED')}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded shadow transition-colors"
            >
              Mark as Submitted Manually (Done on Upwork)
            </button>
          </div>
        </div>
      )}

      {/* Job Details Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 leading-snug">{job.title || 'Untitled Job'}</h2>
            <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
              <span>ID: {job.upworkJobId}</span>
              <span>•</span>
              <span>Country: {job.clientCountry || 'Not Available'}</span>
              <span>•</span>
              <span>
                Budget:{' '}
                {job.budgetType === 'FIXED'
                  ? `$${job.budgetAmountFixed}`
                  : `$${job.hourlyRateMin ?? '?'}-$${job.hourlyRateMax ?? '?'}/hr`}
              </span>
              <span>•</span>
              <span>Proposals: {job.proposalCount !== null ? job.proposalCount : 'Not Available'}</span>
            </div>
          </div>

          {job.jobUrl && (
            <a
              href={job.jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-700 font-semibold hover:underline"
            >
              Open on Upwork ↗
            </a>
          )}
        </div>

        {job.description && (
          <div className="bg-slate-50 p-4 rounded border border-slate-100 text-xs text-slate-700 leading-relaxed max-h-48 overflow-y-auto">
            {job.description}
          </div>
        )}
      </div>

      {/* AI Score & Reasoning */}
      {score && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-slate-900 text-white px-2.5 py-1 rounded">
                AI Score: {score.score}/100 ({score.label})
              </span>
              <span className="text-xs text-slate-400">Generated by {score.modelName}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700 bg-slate-50 p-3 rounded">
            {score.reasons.map((r, i) => (
              <div key={i} className="flex items-start space-x-1.5">
                <span className="text-emerald-600 font-bold">•</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proposal Draft Editor */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h3 className="text-base font-bold text-slate-900">Proposal Draft</h3>
            {/* Version Selectors */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded">
              {job.drafts.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleVersionChange(d.version)}
                  className={`text-xs px-2.5 py-1 rounded font-semibold transition-colors ${
                    selectedVersion === d.version ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  v{d.version}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span
              className={`font-semibold ${
                wordCount >= 180 && wordCount <= 240
                  ? 'text-emerald-700'
                  : wordCount > 250
                  ? 'text-amber-700'
                  : 'text-slate-500'
              }`}
            >
              {wordCount} words (Target: ~200)
            </span>
          </div>
        </div>

        {/* Portfolio Link Matcher */}
        <div className="bg-slate-50 p-3.5 rounded border border-slate-200 flex items-center justify-between text-xs">
          <div>
            <span className="font-semibold text-slate-700">Suggested Portfolio Sample:</span>
            <select
              value={selectedPortfolioId}
              onChange={(e) => setSelectedPortfolioId(e.target.value)}
              className="ml-2 bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800"
            >
              <option value="">-- No specific sample link --</option>
              {portfolioList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          {selectedPortfolioId && (
            <span className="text-slate-500 truncate max-w-xs">
              Link: {portfolioList.find((p) => p.id === selectedPortfolioId)?.link}
            </span>
          )}
        </div>

        {/* Text Area */}
        <div>
          <textarea
            rows={10}
            value={editableText}
            onChange={(e) => setEditableText(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-4 text-xs font-mono leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Proposal draft..."
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => executeAction('SAVE_DRAFT_VERSION')}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded shadow-sm transition-colors"
            >
              Save as New Version (v{job.drafts.length + 1})
            </button>

            <button
              type="button"
              onClick={() => executeAction('SKIP')}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-700 text-xs font-semibold rounded transition-colors"
            >
              Skip Job
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={() => executeAction('APPROVE')}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-sm transition-colors"
            >
              Approve for Manual Submit →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
