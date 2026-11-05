import Link from 'next/link';

export default function ReviewQueuePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Proposal Review Queue</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Human-in-the-loop review. You review drafts here and submit manually on Upwork.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <p className="text-slate-600 text-sm">
          No proposals in queue yet. Once Upwork is connected in Step 2, jobs will be scored and drafts generated in Step 3 &amp; 4.
        </p>
        <div className="mt-4">
          <Link
            href="/settings/connection"
            className="text-emerald-700 font-medium text-sm hover:underline"
          >
            Check Upwork Connection Status →
          </Link>
        </div>
      </div>
    </div>
  );
}
