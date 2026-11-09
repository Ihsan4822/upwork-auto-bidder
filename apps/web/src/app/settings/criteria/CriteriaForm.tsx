'use client';

import React, { useState } from 'react';
import type { JobCriteria } from '@upwork-bidder/core';

/**
 * CriteriaForm: the interactive criteria form.
 *
 * Client component. It takes the current criteria and the defaults as
 * props from the server page, so it imports nothing from
 * @upwork-bidder/core at runtime. Only the JobCriteria type is imported,
 * and type-only imports are erased at compile time, so the core barrel
 * (and the Node-only `fs` module it pulls in through token-service and
 * the Prisma client) never enters the browser bundle. Importing the
 * barrel from a client component broke the Vercel production build.
 *
 * Saving still goes through POST /api/settings/criteria, which validates
 * with CriteriaSchema and re-checks the session server-side.
 */
const FARID_HOURLY_RATE_USD = 15;

export default function CriteriaForm({
  initialCriteria,
  defaultCriteria,
  loadFailed,
}: {
  initialCriteria: JobCriteria;
  defaultCriteria: JobCriteria;
  loadFailed: boolean;
}) {
  const [criteria, setCriteria] = useState<JobCriteria>({ ...initialCriteria });
  const [saving, setSaving] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(
    loadFailed
      ? { type: 'error', text: 'Could not load the current criteria. Showing defaults.' }
      : null,
  );

  async function handleSave() {
    setSaving(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch('/api/settings/criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria),
      });
      const data = await res.json();
      if (res.ok && data.criteria) {
        setCriteria(data.criteria);
        setFeedbackMessage({
          type: 'success',
          text: 'Criteria saved. The worker reads them on the next poll cycle, no restart needed.',
        });
      } else {
        const detail = Array.isArray(data.details)
          ? data.details.map((d: { field: string; message: string }) => `${d.field}: ${d.message}`).join('; ')
          : data.error || 'Failed to save criteria';
        setFeedbackMessage({ type: 'error', text: detail });
      }
    } catch (err: unknown) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Network error while saving',
      });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setCriteria({ ...defaultCriteria });
    setFeedbackMessage({
      type: 'success',
      text: 'Defaults restored in the form. Press Save to apply them.',
    });
  }

  function handleAddKeyword() {
    const keyword = newKeyword.trim();
    if (!keyword) return;
    if (criteria.nicheKeywords.some((k) => k.toLowerCase() === keyword.toLowerCase())) {
      setFeedbackMessage({ type: 'error', text: 'That keyword is already in the list.' });
      return;
    }
    if (criteria.nicheKeywords.length >= 20) {
      setFeedbackMessage({ type: 'error', text: 'At most 20 niche keywords.' });
      return;
    }
    setCriteria((prev) => ({ ...prev, nicheKeywords: [...prev.nicheKeywords, keyword] }));
    setNewKeyword('');
  }

  function handleRemoveKeyword(keyword: string) {
    setCriteria((prev) => ({
      ...prev,
      nicheKeywords: prev.nicheKeywords.filter((k) => k !== keyword),
    }));
  }

  const numberField = (
    label: string,
    value: number,
    onChange: (value: number) => void,
    hint: string,
    suffix: string,
  ) => (
    <div>
      <label className="block text-sm font-semibold text-slate-900">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={0}
          step={1}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <span className="text-sm text-slate-500">{suffix}</span>
      </div>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Job Criteria Settings</h2>
        <p className="text-sm text-slate-600 mt-1">
          Set the minimums yourself. Jobs below these never reach scoring. Changes apply on the
          next poll cycle, no restart needed.
        </p>
      </div>

      {feedbackMessage && (
        <div
          className={`p-4 rounded-md text-sm border ${
            feedbackMessage.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {feedbackMessage.text}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
        {numberField(
          'Minimum hourly rate',
          criteria.hourlyRateFloorUsd,
          (value) => setCriteria((prev) => ({ ...prev, hourlyRateFloorUsd: value })),
          `Farid's Upwork rate is $${FARID_HOURLY_RATE_USD}/hr. Setting this below $${FARID_HOURLY_RATE_USD} brings jobs that pay less than his rate.`,
          'USD / hr',
        )}

        {numberField(
          'Minimum fixed budget',
          criteria.fixedPriceFloorUsd,
          (value) => setCriteria((prev) => ({ ...prev, fixedPriceFloorUsd: value })),
          'Fixed-price jobs below this budget are filtered out.',
          'USD',
        )}

        {numberField(
          'Minimum client total spend',
          criteria.clientMinTotalSpendUsd,
          (value) => setCriteria((prev) => ({ ...prev, clientMinTotalSpendUsd: value })),
          '0 means no minimum. When set, a client whose lifetime spend is known and below this is filtered out. Jobs where the spend is not returned are not punished.',
          'USD (0 = no minimum)',
        )}

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <input
              type="checkbox"
              checked={criteria.paymentVerifiedRequired}
              onChange={(e) =>
                setCriteria((prev) => ({ ...prev, paymentVerifiedRequired: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Payment verified required
          </label>
          <p className="text-xs text-slate-500 mt-1">
            When on, only jobs from payment-verified clients pass. Turn it off only to see jobs
            from unverified clients too.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900">Niche keywords</label>
          <p className="text-xs text-slate-500 mt-1">
            A job must mention at least one of these in its title or description to count as
            relevant. Remove broad words to stop irrelevant jobs arriving.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {criteria.nicheKeywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-800"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(keyword)}
                  aria-label={`Remove ${keyword}`}
                  className="text-emerald-600 hover:text-emerald-900 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
            {criteria.nicheKeywords.length === 0 && (
              <span className="text-xs text-slate-500">No keywords. Add at least one.</span>
            )}
          </div>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddKeyword();
                }
              }}
              placeholder="Add a niche keyword"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleAddKeyword}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium rounded-md border border-slate-300 transition-colors"
            >
              Add keyword
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || criteria.nicheKeywords.length === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save criteria'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium rounded-md border border-slate-300 transition-colors"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
