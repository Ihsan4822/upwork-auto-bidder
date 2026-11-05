'use client';

import React, { useState, useEffect } from 'react';
import { NICHES_IN_SCOPE } from '@upwork-bidder/config';

interface PortfolioItem {
  id: string;
  title: string;
  link: string;
  nicheTags: string[];
  isActive: boolean;
  createdAt: string;
}

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    try {
      const res = await fetch('/api/portfolio');
      const data = await res.json();
      setItems(data.items || []);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  function toggleNiche(niche: string) {
    if (selectedNiches.includes(niche)) {
      setSelectedNiches(selectedNiches.filter((n) => n !== niche));
    } else {
      setSelectedNiches([...selectedNiches, niche]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !link) return;

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          link,
          nicheTags: selectedNiches,
        }),
      });

      if (res.ok) {
        setTitle('');
        setLink('');
        setSelectedNiches([]);
        setMessage('Portfolio sample added successfully!');
        await fetchItems();
      } else {
        const errData = await res.json();
        setMessage(`Error: ${errData.error || 'Failed to add item'}`);
      }
    } catch (err: unknown) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Portfolio Library (Module 5)</h2>
        <p className="text-sm text-slate-600 mt-1">
          Registered portfolio samples for Farid Malik. The AI matcher references these samples in drafted proposals.
        </p>
      </div>

      {message && (
        <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          {message}
        </div>
      )}

      {/* Add New Item Form */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Add Real Portfolio Sample</h3>
        <p className="text-xs text-slate-500">
          Section 4, Module 5: Enter only genuine portfolio links. The app never invents samples or metrics.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Sample Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Kitchen Appliance Premium A Plus Content"
              className="w-full border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Portfolio Link (URL)</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://faridmalik.design/sample-work"
              className="w-full border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Niche Tags</label>
            <div className="flex flex-wrap gap-2">
              {NICHES_IN_SCOPE.map((niche) => {
                const isSelected = selectedNiches.includes(niche);
                return (
                  <button
                    key={niche}
                    type="button"
                    onClick={() => toggleNiche(niche)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {niche}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Portfolio Sample'}
            </button>
          </div>
        </form>
      </div>

      {/* List Existing Items */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Current Portfolio Samples ({items.length})</h3>

        {loading ? (
          <p className="text-xs text-slate-500">Loading samples...</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-slate-500">No samples registered yet. Add your first sample above.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.id} className="py-3 flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-700 hover:underline block mt-0.5"
                  >
                    {item.link} ↗
                  </a>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.nicheTags.map((tag, i) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">
                  Active
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
